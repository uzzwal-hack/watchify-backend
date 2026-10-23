const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../lib/authGuard');

const KLYPHIC = 'https://apis.klyphic.in';
const KEYS = [
    process.env.KLYPHIC_KEY_1,
    process.env.KLYPHIC_KEY_2,
    process.env.KLYPHIC_KEY_3
].filter(Boolean);

let idx = 0;
const nextKey = () => (KEYS.length ? KEYS[idx++ % KEYS.length] : '');

// 1. SEARCH: Spotify for metadata -> SoundCloud as fallback
router.get('/search', requireAuth, async (req, res) => {
    const { query, limit = 15 } = req.query;
    if (!query) return res.status(400).json({ error: 'query required' });
    
    try {
        console.log("Searching Spotify for:", query);
        const { data } = await axios.get(`${KLYPHIC}/search/spotify`, {
            params: { token: nextKey(), query, limit: Math.min(Number(limit), 20) },
            timeout: 15000,
        });

        let tracks = data.results || data.data?.tracks || [];
        
        if (tracks.length === 0) {
            console.log("Spotify returned 0 results, falling back to SoundCloud");
            const scData = await axios.get(`${KLYPHIC}/music/soundcloud`, {
                params: { token: nextKey(), query, limit: Math.min(Number(limit), 20) },
                timeout: 15000,
            });
            tracks = scData.data?.tracks || scData.results || scData.tracks || [];
        }

        const formatted = tracks.map(t => ({
            id: t.id || Math.random(),
            title: t.title || t.name,
            artist: t.artist || t.artists?.[0]?.name || "Unknown Artist",
            thumbnail: t.thumbnail || t.album?.images?.[0]?.url || t.artwork_url,
            permalink_url: t.permalink_url || t.external_urls?.spotify || t.url,
            duration: t.duration || t.duration_ms || 0
        }));

        res.json({ ok: true, results: formatted });
    } catch (e) {
        const status = e.response?.status;
        res.status(status || 502).json({ error: 'search failed', detail: e.message });
    }
});

// 2. STREAM: YouTube primary -> SoundCloud fallback
router.get('/stream', async (req, res) => {
    const { url, json } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
        console.log("Resolving stream for:", url);
        let audioUrl = null;

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const ytData = await axios.get(`${KLYPHIC}/downloader/yt`, {
                params: { token: nextKey(), url, format: 'mp3' },
                timeout: 30000,
            });
            audioUrl = ytData.data.download_url || ytData.data.data?.download_url || ytData.data.url;
        } else {
            const scData = await axios.get(`${KLYPHIC}/music/soundclouddl`, {
                params: { token: nextKey(), url },
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'audio/mpeg,audio/*,*/*',
                    'Referer': 'https://soundcloud.com/'
                }
            });
            audioUrl = scData.data.download_url || scData.data.data?.download_url || scData.data.url;
        }

        if (!audioUrl) {
            return res.status(404).json({ error: "No playable stream found" });
        }

        if (json === 'true' || req.headers.accept?.includes('application/json')) {
            return res.json({ ok: true, stream_url: audioUrl });
        }
        return res.redirect(audioUrl);

    } catch (e) { 
        console.error("STREAM ERROR:", e.message);
        res.status(502).json({ error: 'stream failed', detail: e.message }); 
    }
});

module.exports = router;
