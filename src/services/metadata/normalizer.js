function similarity(a, b) {
    if (!a || !b) return 0;
    const A = a.toLowerCase().trim(), B = b.toLowerCase().trim();
    if (A === B) return 1;
    const longer = A.length > B.length ? A : B, shorter = A.length > B.length ? B : A;
    if (longer.includes(shorter)) return shorter.length / longer.length;
    const setA = new Set(A.split('')), setB = new Set(B.split(''));
    let inter = 0; for (const c of setA) if (setB.has(c)) inter++;
    return (2 * inter) / (setA.size + setB.size);
}
const conf = (s) => s >= 0.95 ? 'HIGH' : s >= 0.75 ? 'MEDIUM' : s >= 0.5 ? 'LOW' : 'NOT_FOUND';
const confidenceForMovie = (q, r) =>
    conf(Math.max(similarity(q, r.title || ''), similarity(q, r.original_title || '')));
const confidenceForSong = (q, r) => conf(similarity(q, r.title || ''));

const FORBIDDEN = ['watch_link','link_480p','link_720p','link_1080p','link_4k','audio_url','download_url'];
function sanitize(payload) {
    const out = { ...payload };
    for (const f of FORBIDDEN) delete out[f];
    return out;
}
module.exports = { similarity, confidenceForMovie, confidenceForSong, sanitize };
