const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// 1. HOME CATEGORIES (Loads from Supabase)
router.get('/home', requireAuth, async (req, res) => {
    try {
        const { data: movies } = await supabase
            .from('custom_movies')
            .select('*')
            .order('created_at', { ascending: false });

        const categorized = {
            bollywood: movies?.filter(m => m.genre === 'Bollywood') || [],
            hollywood: movies?.filter(m => m.genre === 'Hollywood') || [],
            anime: movies?.filter(m => m.genre === 'Anime') || [],
            south: movies?.filter(m => m.genre === 'South Movies') || [],
            webSeries: movies?.filter(m => m.genre === 'Web Series') || [],
            musicVideos: movies?.filter(m => m.genre === 'Music Videos') || [],
            newMovies: movies?.slice(0, 10) || []
        };

        res.json({ ok: true, data: categorized });
    } catch (error) {
        res.status(502).json({ error: 'Failed to load home', detail: error.message });
    }
});

// 2. LIVE SEARCH (Searches MovieBox AND saves to DB for categories)
router.get('/search', requireAuth, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'query required' });

    try {
        // Fetch from MovieBox
        const [hiRes, enRes] = await Promise.all([
            axios.get(`${MOVIEBOX_API}/search`, { params: { q: `${q} Hindi` }, timeout: 15000 }).catch(() => ({ data: { results: [] } })),
            axios.get(`${MOVIEBOX_API}/search`, { params: { q }, timeout: 15000 }).catch(() => ({ data: { results: [] } }))
        ]);
        
        const allResults = [...(hiRes.data?.results || []), ...(enRes.data?.results || [])];
        const uniqueMovieBox = Array.from(new Map(allResults.map(item => [item.subject_id, item])).values());

        // 🚨 AUTO-SAVE TO SUPABASE
        // We save the top 5 results to the database under "Web Series" or "Bollywood" 
        // so they show up in categories next time.
        for (const movie of uniqueMovieBox.slice(0, 5)) {
            const { data: existing } = await supabase
                .from('custom_movies')
                .select('id')
                .eq('subject_id', movie.subject_id)
                .maybeSingle();

            if (!existing) {
                // Determine category based on language
                const isHindi = movie.language?.toLowerCase().includes('hindi') || q.toLowerCase().includes('hindi');
                const genre = isHindi ? 'Bollywood' : 'Web Series';

                await supabase.from('custom_movies').insert({
                    title: movie.title,
                    poster_url: movie.cover,
                    subject_id: movie.subject_id,
                    language: movie.language || 'Hindi',
                    genre: genre,
                    status: 'PUBLISHED',
                    watch_url: null
                });
            }
        }

        res.json({ ok: true, data: uniqueMovieBox });
    } catch (error) {
        res.status(502).json({ error: 'Search failed', detail: error.message });
    }
});

// 3. GET STREAM LINK (Fetches fresh link live)
router.get('/stream/:subjectId', requireAuth, async (req, res) => {
    const { subjectId } = req.params;
    try {
        console.log('Fetching fresh link for:', subjectId);
        const { data } = await axios.get(`${MOVIEBOX_API}/Movie/api/stream/${subjectId}`, { timeout: 20000 });
        
        // Update the DB with the fresh link silently
        await supabase.from('custom_movies').update({ 
            watch_url: data?.data?.[0]?.url,
            last_updated: new Date().toISOString()
        }).eq('subject_id', subjectId);

        res.json({ ok: true, data: data.data });
    } catch (error) {
        res.status(502).json({ error: 'Failed to fetch stream', detail: error.message });
    }
});

module.exports = router;
