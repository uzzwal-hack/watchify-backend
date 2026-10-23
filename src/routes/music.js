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

// Helper: Tries Key 1, then Key 2, then Key 3
async function fetchWithFallback(endpoint, params) {
    let lastError = null;
    
    for (let i = 0; i < KEYS.length; i++) {
        try {
            const token = KEYS[i];
            const { data } = await axios.get(`${KLYPHIC}${endpoint}`, {
                params: { ...params, token },
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/json, audio/mpeg, */*'
                }
            });
            // If successful, return data immediately and stop trying other keys
            return data; 
        } catch (error) {
            lastError = error;
            const status = error.response?.status;
            console.log(`Key ${i + 1} failed with status ${status}. Trying next key...`);
            
            // If it's a 401 (Unauthorized) or 429 (Rate Limit), continue to next key.
            // If it's a 500 (Server Error), we still try the next key just in case.
            if (i === KEYS.length - 1) {
                console.error("All API keys exhausted.");
            }
        }
    }
    throw lastError || new Error("All API keys failed");
}

// 1. SEARCH: Try Spotify -> Fallback to SoundCloud
router.get('/search', requireAuth, async (req, res) => {
    const { query, limit = 15 } = req.query;
    if (!query) return res.status(400).json({ error: 'query required' });
    
    try {
        console.log("Searching Spotify for:", query);
        let data = null;
        
        try {
            data = await fetchWithFallback('/search/spotify', { query, limit });
        } catch (e) {
            console.log("Spotify failed, falling back to SoundCloud");
            data = await fetchWithFallback('/music/soundcloud', { query, limit });
        }

        let tracks = data.results || data.data?.tracks || data.tracks || [];
        
        const formatted = tracks.map(t => ({
            id: t.id || Math.random(),
            title: t.title || t.name,
            artist: t.artist || t.artists?.[0]?.name || "Unknown Artist",
            thumbnail: t.thumbnail || t.album?.images?.[0]?.url || t.artwork_url,
            permalink_url: `ytsearch:${t.title} ${t.artist || ''} audio`,
            duration: t.duration || t.duration_ms || 0
        }));

        res.json({ ok: true, results: formatted });
    } catch (e) {
        res.status(502).json({ error: 'search failed', detail: e.message });
    }
});

// 2. STREAM: Resolve YouTube URL using the fallback logic
router.get('/stream', async (req, res) => {
    const { url, json } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    try {
        console.log("Resolving stream for:", url);
        let audioUrl = null;
        let data = null;

        if (url.startsWith('ytsearch:') || url.includes('youtube.com') || url.includes('youtu.be')) {
            const searchQuery = url.startsWith('ytsearch:') ? url.replace('ytsearch:', '') : url;
            
            // Use the fallback logic for YouTube
            data = await fetchWithFallback('/downloader/yt', { 
                query: url.startsWith('ytsearch:') ? searchQuery : undefined,
                url: url.startsWith('ytsearch:') ? undefined : searchQuery,
                format: 'mp3' 
            });
            audioUrl = data.download_url || data.data?.download_url || data.url;
        } else {
            // Use the fallback logic for SoundCloud
            data = await fetchWithFallback('/music/soundclouddl', { url });
            audioUrl = data.download_url || data.data?.download_url || data.url;
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
