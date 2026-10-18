const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../lib/authGuard');
const movieProvider = require('../services/metadata/movieProvider');
const songProvider = require('../services/metadata/songProvider');
const { confidenceForMovie, confidenceForSong, sanitize } = require('../services/metadata/normalizer');
const supabase = require('../lib/supabase');

router.post('/movie', requireAdmin, async (req, res) => {
    const { name, tmdb_id } = req.body;
    if (!name && !tmdb_id) return res.status(400).json({ error: 'name or tmdb_id required' });
    try {
        if (tmdb_id) {
            const detail = await movieProvider.getMovieDetail(tmdb_id);
            return res.json({ status: 'ok', confidence: 'HIGH', candidates: [sanitize(detail)] });
        }
        const candidates = await movieProvider.searchMovies(name);
        if (!candidates.length) return res.json({ status: 'not_found' });
        if (candidates.length === 1) {
            const detail = await movieProvider.getMovieDetail(candidates[0].tmdb_id);
            return res.json({ status: 'ok', confidence: confidenceForMovie(name, detail), candidates: [sanitize(detail)] });
        }
        return res.json({ status: 'ambiguous', candidates: candidates.map(sanitize) });
    } catch (e) { res.status(502).json({ error: 'metadata provider failed', detail: e.message }); }
});

router.post('/song', requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const candidates = await songProvider.searchSongs(name);
        if (!candidates.length) return res.json({ status: 'not_found' });
        const enriched = await Promise.all(candidates.slice(0, 5).map(async (c) => {
            const extra = await songProvider.enrichFromLastFm(c.title, c.artist);
            return sanitize({ ...c, ...extra });
        }));
        if (enriched.length === 1) {
            return res.json({ status: 'ok', confidence: confidenceForSong(name, enriched[0]), candidates: enriched });
        }
        return res.json({ status: 'ambiguous', candidates: enriched });
    } catch (e) { res.status(502).json({ error: 'metadata provider failed', detail: e.message }); }
});

router.post('/bulk/movie', requireAdmin, async (req, res) => {
    const { names } = req.body;
    if (!Array.isArray(names) || !names.length || names.length > 25)
        return res.status(400).json({ error: 'names must be array of 1..25' });
    const results = [];
    for (const n of names) {
        try {
            const candidates = await movieProvider.searchMovies(n);
            if (!candidates.length) results.push({ name: n, status: 'not_found' });
            else if (candidates.length === 1) {
                const detail = await movieProvider.getMovieDetail(candidates[0].tmdb_id);
                results.push({ name: n, status: 'ok', confidence: confidenceForMovie(n, detail), candidate: sanitize(detail) });
            } else results.push({ name: n, status: 'ambiguous', candidates: candidates.map(sanitize) });
        } catch (e) { results.push({ name: n, status: 'error', error: e.message }); }
    }
    res.json({ results });
});

router.post('/accept', requireAdmin, async (req, res) => {
    const { entity, entity_id, source, confidence, fields } = req.body;
    await supabase.from('admin_activity_log').insert({
        admin_id: req.admin.id, action: `metadata_accept_${entity}`,
        details_json: JSON.stringify({ entity_id, source, confidence, fields }),
    });
    res.json({ ok: true });
});

router.post('/reject', requireAdmin, async (req, res) => {
    const { entity, query } = req.body;
    await supabase.from('admin_activity_log').insert({
        admin_id: req.admin.id, action: `metadata_reject_${entity}`,
        details_json: JSON.stringify({ query }),
    });
    res.json({ ok: true });
});

module.exports = router;
