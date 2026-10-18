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
        console.log("KLYPHIC RAW:", JSON.stringify(data).substring(0, 300));
        console.log('[klyphic/search] status=200 shape=', JSON.stringify(data).slice(0, 2000));
        const tracks = data.data?.tracks || data.results || data.tracks || (Array.isArray(data.data) ? data.data : []);
        res.json({ ok: true, results: tracks });
    } catch (e) {
        const status = e.response?.status;
        const body = e.response?.data;
        console.error('[klyphic/search] FAILED status=', status, 'body=', JSON.stringify(body).slice(0, 500));
        res.status(status || 502).json({
            error: 'search failed',
            status,
            detail: e.message,
        });
    }
});

router.get('/stream', requireAuth, async (req, res) => {
    const { url, limit = 5 } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
        const { data } = await axios.get(`${KLYPHIC}/music/soundcloudstream`, {
            params: { token: nextKey(), url, limit, format: 'mp3' },
            timeout: 30000,
        });
        res.json({ ok: true, data });
    } catch (e) { res.status(502).json({ error: 'stream failed', detail: e.message }); }
});

router.get('/download', requireAuth, async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
        const upstream = await axios.get(`${KLYPHIC}/music/soundclouddl`, {
            params: { token: nextKey(), url },
            responseType: 'stream', timeout: 60000,
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        upstream.data.pipe(res);
    } catch (e) { res.status(502).json({ error: 'download failed', detail: e.message }); }
});

module.exports = router;
