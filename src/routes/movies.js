const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// 1. HOME CATEGORIES (Fetched from your Supabase DB)
router.get('/home', requireAuth, async (req, res) => {
    try {
        // Only fetch movies > 20 mins (1200 sec)
        const { data: movies } = await supabase
            .from('custom_movies')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter out short videos just in case
        const validMovies = movies?.filter(m => m.duration === 0 || m.duration > 1200) || [];

        const categorized = {
            bollywood: validMovies.filter(m => m.genre === 'Bollywood'),
            anime: validMovies.filter(m => m.genre === 'Anime'),
            hollywood: validMovies.filter(m => m.genre === 'Hollywood'),
            romance: validMovies.filter(m => m.genre === 'Romance'),
            newMovies: validMovies.slice(0, 10)
        };

        res.json({ ok: true, data: categorized });
    } catch (error) {
        res.status(502).json({ error: 'Failed to load home', detail: error.message });
    }
});

// 2. SEARCH MOVIES (Live)
router.get('/search', requireAuth, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'query required' });

    try {
        const [hiRes, enRes] = await Promise.all([
            axios.get(`${MOVIEBOX_API}/search`, { params: { q: `${q} Hindi` }, timeout: 15000 }).catch(() => ({ data: { results: [] } })),
            axios.get(`${MOVIEBOX_API}/search`, { params: { q }, timeout: 15000 }).catch(() => ({ data: { results: [] } }))
        ]);
        
        const allResults = [...(hiRes.data?.results || []), ...(enRes.data?.results || [])];
        
        // Filter out videos < 20 mins
        const filteredResults = allResults.filter(m => {
            const duration = m.duration || 0;
            return duration === 0 || duration > 1200; 
        });

        const uniqueMovieBox = Array.from(new Map(filteredResults.map(item => [item.subject_id, item])).values());

        res.json({ ok: true, data: uniqueMovieBox });
    } catch (error) {
        res.status(502).json({ error: 'Search failed', detail: error.message });
    }
});

// 3. GET STREAM LINK
router.get('/stream/:subjectId', requireAuth, async (req, res) => {
    const { subjectId } = req.params;
    try {
        if (subjectId.startsWith('custom_')) {
            const dbId = subjectId.replace('custom_', '');
            const { data: movie } = await supabase.from('custom_movies').select('watch_url').eq('id', dbId).single();
            if (!movie || !movie.watch_url) throw new Error("Custom movie link not found");
            return res.json({ ok: true, data: [{ url: movie.watch_url }] });
        }

        const { data } = await axios.get(`${MOVIEBOX_API}/Movie/api/stream/${subjectId}`, { timeout: 20000 });
        res.json({ ok: true, data: data.data });

    } catch (error) {
        res.status(502).json({ error: 'Failed to fetch stream', detail: error.message });
    }
});

module.exports = router;
