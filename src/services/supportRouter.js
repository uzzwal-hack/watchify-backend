const supabase = require('../lib/supabase');

async function assignTicket(ticketId) {
    const { data: admins } = await supabase.from('profiles')
        .select('id,nickname,role').in('role', ['MODERATOR','SENIOR_ADMIN']);
    if (!admins?.length) throw new Error('no admins');

    const load = {};
    for (const a of admins) {
        const { count } = await supabase.from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_admin_id', a.id)
            .in('status', ['OPEN','IN_PROGRESS','FORWARDED']);
        load[a.id] = count || 0;
    }
    const { data: state } = await supabase.from('support_routing_state')
        .select('*').eq('id', 'global').single();
    const last = state?.last_assigned_admin_id;
    const sorted = admins.sort((a, b) => {
        if (load[a.id] !== load[b.id]) return load[a.id] - load[b.id];
        if (a.id === last) return 1;
        if (b.id === last) return -1;
        return a.id.localeCompare(b.id);
    });
    const chosen = sorted[0];

    await supabase.from('support_tickets').update({
        assigned_admin_id: chosen.id,
        assigned_at: new Date().toISOString(),
        status: 'OPEN',
    }).eq('id', ticketId);

    await supabase.from('support_routing_state').update({
        last_assigned_admin_id: chosen.id,
        last_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('id', 'global');

    await supabase.from('admin_activity_log').insert({
        admin_id: chosen.id, action: 'support_assigned',
        details_json: JSON.stringify({ ticket_id: ticketId }),
    });
    return chosen;
}

async function forwardTicket(ticketId, fromAdminId, toAdminId) {
    await supabase.from('support_tickets').update({
        assigned_admin_id: toAdminId,
        forwarded_from: fromAdminId,
        forwarded_at: new Date().toISOString(),
        status: 'FORWARDED',
    }).eq('id', ticketId);
    await supabase.from('admin_activity_log').insert({
        admin_id: fromAdminId, action: 'support_forwarded',
        details_json: JSON.stringify({ ticket_id: ticketId, to: toAdminId }),
    });
}
module.exports = { assignTicket, forwardTicket };
