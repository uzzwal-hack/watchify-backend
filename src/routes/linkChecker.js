const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../lib/authGuard');
const { runOnce } = require('../services/linkChecker');
const supabase = require('../lib/supabase');

router.post('/run-now', requireAdmin, async (_req, res) => {
    try { await runOnce(); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/health', requireAdmin, async (_req, res) => {
    const { data } = await supabase.from('movie_link_health')
        .select('*').eq('status', 'dead')
        .order('last_checked_at', { ascending: false }).limit(200);
    res.json({ dead: data || [] });
});
module.exports = router;
