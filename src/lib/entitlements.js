const { roleFor } = require('./adminRoster');

/**
 * Returns { allowed: boolean, reason?: string, remaining?: number }
 * Admins are always allowed.
 */
async function canWatchMovie(supabase, userId, userEmail, movieId) {
    // 1. Admin bypass — authoritative, from the roster, not from profiles.role
    const role = roleFor(userEmail);
    if (['MODERATOR', 'SENIOR_ADMIN'].includes(role)) {
        return { allowed: true, reason: 'admin', remaining: -1 };
    }

    // 2. Read membership from profiles
    const { data: profile } = await supabase
        .from('profiles')
        .select('membership_tier, membership_status, membership_expiry')
        .eq('id', userId)
        .single();

    if (!profile) return { allowed: false, reason: 'no_profile' };

    const expired = profile.membership_expiry
        && new Date(profile.membership_expiry) < new Date();
    const active = profile.membership_status === 'ACTIVE' && !expired;

    const tier = (profile.membership_tier || 'NONE').toUpperCase();
    const monthlyQuota = {
        NONE: 10,
        MONTHLY: 30,
        SIX_MONTH: 40,
        YEARLY: 60,
    }[tier] || 10;

    // 3. Count this month's watches
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
        .from('watch_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('watched_at', startOfMonth.toISOString());

    const used = count || 0;
    const remaining = Math.max(0, monthlyQuota - used);

    if (!active && tier !== 'NONE') {
        // Membership expired mid-month
        return { allowed: remaining > 0, reason: 'expired', remaining };
    }
    if (remaining <= 0) {
        return { allowed: false, reason: 'quota_reached', remaining: 0 };
    }
    return { allowed: true, reason: 'ok', remaining };
}

module.exports = { canWatchMovie };
