const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// 1. HOME CATEGORIES (All 14 Categories)
router.get('/home', requireAuth, async (req, res) => {
    try {
        // Fetch all movies from your Supabase table
        const { data: movies } = await supabase
            .from('custom_movies')
            .select('*')
            .order('created_at', { ascending: false });

        // Group them by the exact genre names set by the fetcher
        const categorized = {
            bollywood: movies?.filter(m => m.genre === 'Bollywood') || [],
            hollywood: movies?.filter(m => m.genre === 'Hollywood') || [],
            anime: movies?.filter(m => m.genre === 'Anime') || [],
            south: movies?.filter(m => m.genre === 'South Movies') || [],
            romance: movies?.filter(m => m.genre === 'Romance') || [],
            teenage: movies?.filter(m => m.genre === 'Teenage Love') || [],
            webSeries: movies?.filter(m => m.genre === 'Web Series') || [],
            sciFi: movies?.filter(m => m.genre === 'Sci-Fi') || [],
            horror: movies?.filter(m => m.genre === 'Horror & Thriller') || [],
            crime: movies?.filter(m => m.genre === 'Crime & Gangster') || [],
            superhero: movies?.filter(m => m.genre === 'Superhero') || [],
            kDrama: movies?.filter(m => m.genre === 'K-Drama') || [],
            musicVideos: movies?.filter(m => m.genre === 'Music Videos') || [],
            newMovies: movies?.slice(0, 10) || []
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
        // Search MovieBox (Hindi priority)
        const [hiRes, enRes] = await Promise.all([
            axios.get(`${MOVIEBOX_API}/search`, { params: { q: `${q} Hindi` }, timeout: 15000 }).catch(() => ({ data: { results: [] } })),
            axios.get(`${MOVIEBOX_API}/search`, { params: { q }, timeout: 15000 }).catch(() => ({ data: { results: [] } }))
        ]);
        
        const allResults = [...(hiRes.data?.results || []), ...(enRes.data?.results || [])];
        const uniqueMovieBox = Array.from(new Map(allResults.map(item => [item.subject_id, item])).values());

        // Search Custom DB (Auto-fetched + Manual)
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

// 3. GET STREAM LINK (Fetches fresh link from MovieBox)
router.get('/stream/:subjectId', requireAuth, async (req, res) => {
    const { subjectId } = req.params;

    try {
        // If it's a manual custom movie (has a direct link saved in DB)
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

// 4. ADMIN: ADD CUSTOM MOVIE (Direct Link)
router.post('/custom/add', requireAuth, async (req, res) => {
    const { title, posterUrl, videoUrl, language, genre } = req.body;
    
    try {
        const { data, error } = await supabase.from('custom_movies').insert({
            title: title,
            poster_url: posterUrl,
            watch_url: videoUrl,
            language: language || 'Hindi',
            genre: genre || 'Action'
        }).select().single();

        if (error) throw error;
        res.json({ ok: true, message: 'Custom movie added!', movie: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
