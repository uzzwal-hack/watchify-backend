const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

router.get('/home', requireAuth, async (req, res) => {
    try {
        const { data: movies } = await supabase.from('custom_movies').select('*');

        // Group all categories
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

// ... (Keep your /search and /stream routes exactly as they are) ...

module.exports = router;
