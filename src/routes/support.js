const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../lib/authGuard');
const supabase = require('../lib/supabase');
const { assignTicket, forwardTicket } = require('../services/supportRouter');

router.post('/create', requireAuth, async (req, res) => {
    const { subject, description, priority } = req.body;
    const { data: ticket, error } = await supabase.from('support_tickets').insert({
        user_id: req.user.id, user_email: req.user.email,
        subject, description, priority: priority || 'NORMAL', status: 'NEW',
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    try { await assignTicket(ticket.id); } catch (e) { console.warn('assign failed', e.message); }
    res.json({ ok: true, ticket });
});

router.post('/:id/forward', requireAuth, requireAdmin, async (req, res) => {
    await forwardTicket(req.params.id, req.admin.id, req.body.to_admin_id);
    res.json({ ok: true });
});

router.post('/:id/response', requireAuth, requireAdmin, async (req, res) => {
    await supabase.from('support_tickets').update({
        response_at: new Date().toISOString(), status: 'IN_PROGRESS',
        internal_notes: req.body.notes || null,
    }).eq('id', req.params.id);
    res.json({ ok: true });
});

router.post('/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
    await supabase.from('support_tickets').update({
        resolution_at: new Date().toISOString(), status: 'RESOLVED',
    }).eq('id', req.params.id);
    await supabase.from('admin_activity_log').insert({
        admin_id: req.admin.id, action: 'support_resolved',
        details_json: JSON.stringify({ ticket_id: req.params.id }),
    });
    res.json({ ok: true });
});
module.exports = router;
