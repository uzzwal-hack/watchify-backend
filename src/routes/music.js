const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');

const KLYPHIC = 'https://apis.klyphic.in';
const KEYS = [process.env.KLYPHIC_KEY_1, process.env.KLYPHIC_KEY_2, process.env.KLYPHIC_KEY_3].filter(Boolean);
let idx = 0;
const nextKey = () => (KEYS.length ? KEYS[idx++ % KEYS.length] : '');

router.get('/search', requireAuth, async (req, res) => {
    const { query, limit = 10 } = req.query;
    if (!query) return res.status(400).json({ error: 'query required' });
    try {
        const { data } = await axios.get(`${KLYPHIC}/music/soundcloud`, {
            params: { token: nextKey(), query, limit: Math.min(Number(limit), 20) },
            timeout: 15000,
        });
        const tracks = data.data?.tracks || data.results || data.tracks || (Array.isArray(data.data) ? data.data : []);
        res.json({ ok: true, results: tracks });
    } catch (e) {
        const status = e.response?.status;
        res.status(status || 502).json({ error: 'search failed', detail: e.message });
    }
});

// THE FIX: Use the download endpoint and pipe the raw MP3 stream
router.get('/stream', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    
    try {
        console.log("Piping raw MP3 stream for:", url);
        
        const upstream = await axios.get(`${KLYPHIC}/music/soundclouddl`, {
            params: { token: nextKey(), url },
            responseType: 'stream',
            timeout: 30000,
        });

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes'); // Helps ExoPlayer with buffering
        
        upstream.data.on('error', (err) => {
            console.error("Upstream stream error:", err);
            res.end();
        });

        upstream.data.pipe(res);

    } catch (e) { 
        console.error("STREAM ERROR:", e.message);
        res.status(502).json({ error: 'stream failed', detail: e.message }); 
    }
});

module.exports = router;
