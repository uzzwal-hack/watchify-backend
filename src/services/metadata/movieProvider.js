const axios = require('axios');
const TMDB = 'https://api.themoviedb.org/3';

async function searchMovies(name) {
    if (!process.env.TMDB_API_KEY) return [];
    try {
        const { data } = await axios.get(`${TMDB}/search/movie`, {
            params: { api_key: process.env.TMDB_API_KEY, query: name, include_adult: false },
        });
        return (data.results || []).slice(0, 8).map((r) => ({
            tmdb_id: r.id, title: r.title, original_title: r.original_title,
            release_date: r.release_date, overview: r.overview,
            poster_path: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
            backdrop_path: r.backdrop_path ? `https://image.tmdb.org/t/p/w780${r.backdrop_path}` : null,
            vote_average: r.vote_average,
        }));
    } catch { return []; }
}

async function getMovieDetail(tmdbId) {
    if (!process.env.TMDB_API_KEY) return {};
    const { data: m } = await axios.get(`${TMDB}/movie/${tmdbId}`, {
        params: { api_key: process.env.TMDB_API_KEY },
    });
    const { data: credits } = await axios.get(`${TMDB}/movie/${tmdbId}/credits`, {
        params: { api_key: process.env.TMDB_API_KEY },
    });
    const director = credits.crew?.find((c) => c.job === 'Director')?.name || null;
    const writers = credits.crew?.filter((c) => ['Writer','Screenplay','Story'].includes(c.job))
        .map((c) => c.name).slice(0, 5).join(', ') || null;
    const cast = credits.cast?.slice(0, 10).map((c) => c.name).join(', ') || null;
    const characters = credits.cast?.slice(0, 10).map((c) => c.character).filter(Boolean).join(', ') || null;
    const runtime = m.runtime ?? null;
    const duration = runtime ? `${Math.floor(runtime/60)}h ${runtime%60}m` : null;

    return {
        title: m.title, description: m.overview,
        release_date: m.release_date,
        release_year: m.release_date ? Number(m.release_date.slice(0,4)) : null,
        duration,
        genre: (m.genres || []).map((g) => g.name).join(', '),
        language: m.original_language,
        country: (m.production_countries || []).map((c) => c.name).join(', '),
        director, writers, cast_members: cast, characters,
        studio: (m.production_companies || []).map((c) => c.name).join(', '),
        rating: m.vote_average,
        poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
        banner_url: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
        external_ids: { tmdb: m.id, imdb: m.imdb_id || null },
    };
}

module.exports = { searchMovies, getMovieDetail };
