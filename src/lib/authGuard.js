const supabase = require('./supabase');
const { roleFor } = require('./adminRoster');

async function requireAuth(req, res, next) {
    try {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'missing token' });
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'invalid token' });
        req.user = user;
        next();
    } catch (e) { res.status(500).json({ error: e.message }); }
}

async function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'auth required' });
    const role = roleFor(req.user.email);
    if (!['MODERATOR','SENIOR_ADMIN'].includes(role)) {
        return res.status(403).json({ error: 'admin only' });
    }
    req.admin = { id: req.user.id, email: req.user.email, role };
    next();
}

async function requireModerator(req, res, next) {
    if (req.admin?.role !== 'MODERATOR') {
        return res.status(403).json({ error: 'moderator only' });
    }
    next();
}
module.exports = { requireAuth, requireAdmin, requireModerator };
