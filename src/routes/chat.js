const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth, requireAdmin } = require('../lib/authGuard');
const { roleFor } = require('../lib/adminRoster');

router.get('/messages', requireAuth, async (req, res) => {
    const { before, limit = 50 } = req.query;
    let q = supabase.from('chat_messages')
        .select('id,user_id,message,is_pinned,is_deleted,is_system,reactions,timestamp,reply_to_id')
        .eq('is_deleted', false)
        .order('timestamp', { ascending: false })
        .limit(Math.min(Number(limit), 100));
    if (before) q = q.lt('timestamp', before);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ messages: (data || []).reverse() });
});

router.post('/messages', requireAuth, async (req, res) => {
    const { message, reply_to_id } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'empty message' });
    const { data, error } = await supabase.from('chat_messages').insert({
        user_id: req.user.id,
        message: message.trim().slice(0, 2000),
        reply_to_id: reply_to_id || null,
        timestamp: new Date().toISOString(),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: data });
});

router.post('/messages/:id/react', requireAuth, async (req, res) => {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji required' });
    const { data: existing } = await supabase.from('chat_messages')
        .select('reactions').eq('id', req.params.id).single();
    const reactions = existing?.reactions || {};
    const users = new Set(reactions[emoji] || []);
    users.has(req.user.id) ? users.delete(req.user.id) : users.add(req.user.id);
    reactions[emoji] = Array.from(users);
    await supabase.from('chat_messages').update({ reactions }).eq('id', req.params.id);
    res.json({ ok: true });
});

router.delete('/messages/:id', requireAuth, async (req, res) => {
    const { data: msg } = await supabase.from('chat_messages')
        .select('user_id').eq('id', req.params.id).single();
    const isAdmin = ['MODERATOR','SENIOR_ADMIN'].includes(roleFor(req.user.email));
    if (!msg || (msg.user_id !== req.user.id && !isAdmin)) {
        return res.status(403).json({ error: 'not permitted' });
    }
    await supabase.from('chat_messages').update({ is_deleted: true }).eq('id', req.params.id);
    res.json({ ok: true });
});

router.post('/messages/:id/pin', requireAuth, requireAdmin, async (req, res) => {
    const { data: msg } = await supabase.from('chat_messages')
        .select('is_pinned').eq('id', req.params.id).single();
    await supabase.from('chat_messages')
        .update({ is_pinned: !msg?.is_pinned }).eq('id', req.params.id);
    res.json({ ok: true });
});

router.post('/messages/:id/report', requireAuth, async (req, res) => {
    await supabase.from('chat_messages').update({
        is_reported: true,
        reported_by: req.user.id,
        reported_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    await supabase.from('reports').insert({
        reporter_id: req.user.id,
        target_type: 'chat_message',
        target_id: req.params.id,
        reason: req.body.reason || 'Reported',
        status: 'OPEN',
    });
    res.json({ ok: true });
});

module.exports = router;
