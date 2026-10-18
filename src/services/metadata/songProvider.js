const axios = require('axios');
const MB = 'https://musicbrainz.org/ws/2';
const LF = 'https://ws.audioscrobbler.com/2.0/';

async function searchSongs(name) {
    try {
        const { data } = await axios.get(`${MB}/recording`, {
            params: { query: name, fmt: 'json', limit: 8 },
            headers: { 'User-Agent': process.env.MUSICBRAINZ_USER_AGENT || 'Watchify/1.0 (contact@watchify.app)' },
        });
        return (data.recordings || []).map((r) => ({
            mb_id: r.id, title: r.title,
            artist: r['artist-credit']?.[0]?.name || null,
            album: r.releases?.[0]?.title || null,
            release_date: r['first-release-date'] || null,
        }));
    } catch { return []; }
}

async function enrichFromLastFm(song, artist) {
    if (!process.env.LASTFM_API_KEY) return {};
    try {
        const { data } = await axios.get(LF, {
            params: { method: 'track.getInfo', api_key: process.env.LASTFM_API_KEY,
                artist, track: song, format: 'json' },
        });
        const t = data.track || {};
        return {
            album: t.album?.title || null,
            genre: t.toptags?.tag?.[0]?.name || null,
            artwork_url: t.album?.image?.slice(-1)?.[0]?.['#text'] || null,
            duration: t.duration ? Math.round(t.duration / 1000) : null,
            description: t.wiki?.summary || null,
        };
    } catch { return {}; }
}
module.exports = { searchSongs, enrichFromLastFm };
