const axios = require('axios');
const supabase = require('../lib/supabase');

const FIELDS = { watch: 'watch_link', '480p': 'link_480p', '720p': 'link_720p', '1080p': 'link_1080p', '4k': 'link_4k' };

async function checkUrl(url) {
    try {
        const head = await axios.head(url, { timeout: 8000, maxRedirects: 5, validateStatus: () => true });
        if (head.status >= 200 && head.status < 400) return { ok: true, http: head.status };
        const get = await axios.get(url, { timeout: 8000, maxRedirects: 5, headers: { Range: 'bytes=0-0' }, validateStatus: () => true });
        return { ok: get.status >= 200 && get.status < 400, http: get.status };
    } catch (e) { return { ok: false, http: e.response?.status ?? null, error: e.message }; }
}

async function runOnce() {
    const { data: movies } = await supabase.from('movies')
        .select('id,title,watch_link,link_480p,link_720p,link_1080p,link_4k')
        .in('status', ['PUBLISHED','UPCOMING']);

    for (const m of movies || []) {
        for (const [quality, field] of Object.entries(FIELDS)) {
            const url = m[field]; if (!url) continue;
            const r = await checkUrl(url);
            const { data: existing } = await supabase.from('movie_link_health')
                .select('*').eq('movie_id', m.id).eq('quality', quality).maybeSingle();
            const wasOk = existing?.status === 'ok';
            const nowOk = r.ok;
            const consecutive = nowOk ? 0 : (existing?.consecutive_failures || 0) + 1;
            await supabase.from('movie_link_health').upsert({
                movie_id: m.id, quality, url,
                status: nowOk ? 'ok' : 'dead',
                http_status: r.http,
                last_checked_at: new Date().toISOString(),
                last_ok_at: nowOk ? new Date().toISOString() : existing?.last_ok_at,
                consecutive_failures: consecutive,
                notes: r.error || null,
            }, { onConflict: 'movie_id,quality' });

            if (wasOk && !nowOk) {
                const notify = !existing?.notified_at
                    || (Date.now() - new Date(existing.notified_at).getTime()) > 24 * 3600 * 1000;
                if (notify) {
                    await notifyAdmins(m, quality, url);
                    await supabase.from('movie_link_health')
                        .update({ notified_at: new Date().toISOString() })
                        .eq('movie_id', m.id).eq('quality', quality);
                }
            }
        }
    }
}

async function notifyAdmins(movie, quality, url) {
    const { data: admins } = await supabase.from('profiles')
        .select('id').in('role', ['MODERATOR','SENIOR_ADMIN']);
    const rows = (admins || []).map((a) => ({
        user_id: a.id, type: 'movie_link_dead',
        title: 'Movie link dead',
        message: `${movie.title} — ${quality} link failed`,
        data: { movie_id: movie.id, quality, url }, is_read: false,
    }));
    if (rows.length) await supabase.from('notifications').insert(rows);
    await supabase.from('system_logs').insert({
        action: 'movie_link_dead',
        details: { movie_id: movie.id, quality, url },
    });
}

module.exports = { runOnce };
