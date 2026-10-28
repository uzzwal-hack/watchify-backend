const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// ---------------------------------------------------------
// 1. HOME CATEGORIES (Fetched from your Supabase DB)
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 2. SEARCH MOVIES (Live from MovieBox + Custom DB)
// ---------------------------------------------------------
router.get('/search', requireAuth, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'query required' });

    try {
        // Search MovieBox
        const [hiRes, enRes] = await Promise.all([
            axios.get(`${MOVIEBOX_API}/search`, { params: { q: `${q} Hindi` }, timeout: 15000 }).catch(() => ({ data: { results: [] } })),
            axios.get(`${MOVIEBOX_API}/search`, { params: { q }, timeout: 15000 }).catch(() => ({ data: { results: [] } }))
        ]);
        
        const allResults = [...(hiRes.data?.results || []), ...(enRes.data?.results || [])];
        const uniqueMovieBox = Array.from(new Map(allResults.map(item => [item.subject_id, item])).values());

        // Search Custom DB
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

// ---------------------------------------------------------
// 3. GET STREAM LINK (Fetches fresh link from MovieBox)
// ---------------------------------------------------------
router.get('/stream/:subjectId', requireAuth, async (req, res) => {
    const { subjectId } = req.params;

    try {
        if (subjectId.startsWith('custom_')) {
            const dbId = subjectId.replace('custom_', '');
            const { data: movie } = await supabase.from('custom_movies').select('watch_url').eq('id', dbId).single();
            if (!movie || !movie.watch_url) throw new Error("Custom movie link not found");
            return res.json({ ok: true, data: [{ url: movie.watch_url }] });
        }

        console.log('Fetching fresh MovieBox stream for:', subjectId);
        const { data } = await axios.get(`${MOVIEBOX_API}/Movie/api/stream/${subjectId}`, { timeout: 20000 });
        res.json({ ok: true, data: data.data });

    } catch (error) {
        res.status(502).json({ error: 'Failed to fetch stream', detail: error.message });
    }
});

// ---------------------------------------------------------
// 4. ADMIN: ADD CUSTOM MOVIE (Direct Link)
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 5. AUTO-REFRESHER (Runs safely in background)
// ---------------------------------------------------------
async function autoHealLinks() {
    console.log('[Auto-Refresher] Starting...');
    try {
        const { data: movies } = await supabase
            .from('custom_movies')
            .select('id, subject_id, watch_url, last_updated')
            .eq('status', 'PUBLISHED');

        for (const movie of movies || []) {
            if (!movie.subject_id || movie.subject_id.startsWith('custom_')) continue;
            
            try {
                const { data } = await axios.get(`${MOVIEBOX_API}/Movie/api/stream/${movie.subject_id}`, { timeout: 20000 });
                const links = data?.data || [];
                const bestLink = links.find(l => l.resolution === 720) || links[0];

                if (bestLink && bestLink.url) {
                    await supabase.from('custom_movies').update({
                        watch_url: bestLink.url,
                        last_updated: new Date().toISOString()
                    }).eq('id', movie.id);
                }
            } catch (err) {
                if (err.response?.status === 404) {
                    await supabase.from('custom_movies').update({ status: 'UNAVAILABLE' }).eq('id', movie.id);
                } else {
                    console.error(`[Auto-Refresher] Failed ${movie.id}:`, err.message);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error('Auto-Refresher Error:', error);
    }
    console.log('[Auto-Refresher] Finished.');
}

// Run on start
autoHealLinks();
// Run every 1 hour
setInterval(autoHealLinks, 60 * 60 * 1000);

module.exports = router;
