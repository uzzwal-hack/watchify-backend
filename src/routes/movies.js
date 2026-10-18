const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../lib/authGuard');
const { canWatchMovie } = require('../lib/entitlements');

const ALLOWED = [
    'title','description','poster_url','banner_url','genre','duration',
    'release_year','release_date','rating','status','is_preorder',
    'watch_link','link_480p','link_720p','link_1080p','link_4k',
    'director','writers','cast_members','characters','language','country',
    'studio','external_ids','metadata_source','metadata_confidence',
];

router.get('/:id/can-watch', requireAuth, async (req, res) => {
    try {
        const result = await canWatchMovie(
            supabase,
            req.user.id,
            req.user.email,
            req.params.id,
        );
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    const payload = req.body || {};
    const clean = {};
    for (const k of ALLOWED) if (k in payload) clean[k] = payload[k];
    clean.created_by = req.admin.id;
    clean.is_active = clean.status === 'PUBLISHED';
    const { data, error } = await supabase.from('movies').insert(clean).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('admin_activity_log').insert({
        admin_id: req.admin.id, action: 'movie_created',
        details_json: JSON.stringify({ movie_id: data.id, title: data.title, status: data.status }),
    });
    res.json({ movie: data });
});

router.patch('/:id', requireAdmin, async (req, res) => {
    const patch = { ...(req.body || {}) };
    if ('status' in patch) patch.is_active = patch.status === 'PUBLISHED';
    const { data, error } = await supabase.from('movies')
        .update(patch).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('admin_activity_log').insert({
        admin_id: req.admin.id, action: 'movie_edited',
        details_json: JSON.stringify({ movie_id: data.id, fields: Object.keys(patch) }),
    });
    res.json({ movie: data });
});

router.delete('/:id', requireAdmin, async (req, res) => {
    const { error } = await supabase.from('movies').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    await supabase.from('admin_activity_log').insert({
        admin_id: req.admin.id, action: 'movie_deleted',
        details_json: JSON.stringify({ movie_id: req.params.id }),
    });
    res.json({ ok: true });
});

router.post('/:id/download', async (req, res) => {
    const { data: m } = await supabase.from('movies')
        .select('download_count').eq('id', req.params.id).single();
    const next = (m?.download_count || 0) + 1;
    await supabase.from('movies').update({ download_count: next }).eq('id', req.params.id);
    res.json({ ok: true, download_count: next });
});

module.exports = router;
