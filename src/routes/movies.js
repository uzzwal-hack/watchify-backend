const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// 1. HOME CATEGORIES (Fetched from your Supabase DB)
router.get('/home', requireAuth, async (req, res) => {
    try {
        // Fetch all auto-fetched and custom movies
        const { data: movies } = await supabase
            .from('custom_movies')
            .select('*')
            .order('created_at', { ascending: false });

        // Group them by genre/category
        const categorized = {
            bollywood: movies?.filter(m => m.genre === 'Bollywood') || [],
            anime: movies?.filter(m => m.genre === 'Anime') || [],
            hollywood: movies?.filter(m => m.genre === 'Hollywood') || [],
            romance: movies?.filter(m => m.genre === 'Romance') || [],
            newMovies: movies?.slice(0, 10) || [] // Latest additions
        };

        res.json({ ok: true, data: categorized });
    } catch (error) {
        res.status(502).json({ error: 'Failed to load home', detail: error.message });
    }
});

// 2. SEARCH MOVIES (Live from MovieBox + Custom DB)
router.get('/search', requireAuth, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'query required' });

    try {
        // A. Search MovieBox
        const [hiRes, enRes] = await Promise.all([
            axios.get(`${MOVIEBOX_API}/search`, { params: { q: `${q} Hindi` }, timeout: 15000 }).catch(() => ({ data: { results: [] } })),
            axios.get(`${MOVIEBOX_API}/search`, { params: { q }, timeout: 15000 }).catch(() => ({ data: { results: [] } }))
        ]);
        const allResults = [...(hiRes.data?.results || []), ...(enRes.data?.results || [])];
        const uniqueMovieBox = Array.from(new Map(allResults.map(item => [item.subject_id, item])).values());

        // B. Search Custom DB (Auto-fetched + Manual)
        const { data: customMovies } = await supabase
            .from('custom_movies')
            .select('*')
            .ilike('title', `%${q}%`);

        const formattedCustom = (customMovies || []).map(m => ({
            subject_id: m.subject_id || `custom_${m.id}`,
            title: m.title,
            cover: m.poster_url,
            language: m.language,
            is_custom: true
        }));

        res.json({ ok: true, data: [...formattedCustom, ...uniqueMovieBox] });
    } catch (error) {
        res.status(502).json({ error: 'Search failed', detail: error.message });
    }
});

// 3. GET STREAM LINK (Fetches fresh link from MovieBox if needed)
router.get('/stream/:subjectId', requireAuth, async (req, res) => {
    const { subjectId } = req.params;

    try {
        // If it's a manual custom movie (has a direct link)
        if (subjectId.startsWith('custom_')) {
            const dbId = subjectId.replace('custom_', '');
            const { data: movie } = await supabase.from('custom_movies').select('watch_url').eq('id', dbId).single();
            if (!movie || !movie.watch_url) throw new Error("Custom movie link not found");
            return res.json({ ok: true, data: [{ url: movie.watch_url }] });
        }

        // Otherwise, fetch a fresh link from MovieBox
        console.log('Fetching fresh MovieBox stream for:', subjectId);
        const { data } = await axios.get(`${MOVIEBOX_API}/Movie/api/stream/${subjectId}`, { timeout: 20000 });
        res.json({ ok: true, data: data.data });

    } catch (error) {
        res.status(502).json({ error: 'Failed to fetch stream', detail: error.message });
    }
});

module.exports = router;
