const axios = require('axios');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

const CATEGORY_SEARCHES = {
    'Bollywood': ['Bollywood', 'Hindi Movie', 'Dhurandhar', 'Jawan', 'Animal'],
    'Anime': ['Anime', 'Naruto', 'One Piece', 'Demon Slayer'],
    'Hollywood': ['Hollywood', 'Marvel', 'Avatar', 'Deadpool'],
    'Romance': ['Romance', 'Love Story', 'Romantic Movie']
};

async function fetchAndSaveMovies() {
    console.log('[Auto-Fetcher] Starting movie fetch from MovieBox...');
    
    for (const [category, queries] of Object.entries(CATEGORY_SEARCHES)) {
        for (const query of queries) {
            try {
                const { data } = await axios.get(`${MOVIEBOX_API}/search`, {
                    params: { q: query },
                    timeout: 15000
                });

                const results = data?.results || [];
                const topResults = results.slice(0, 4); // Fetch top 4 per query

                for (const movie of topResults) {
                    // 🚨 DURATION FILTER: Check if duration exists and is > 20 mins (1200 seconds)
                    // Note: If MovieBox doesn't provide duration in search, this check might fail. 
                    // We default to keeping it if duration is missing.
                    const duration = movie.duration || 0; 
                    if (duration > 0 && duration < 1200) {
                        console.log(`[Auto-Fetcher] Skipping short video (${duration}s): ${movie.title}`);
                        continue;
                    }

                    // Check if movie already exists in our DB
                    const { data: existing } = await supabase
                        .from('custom_movies')
                        .select('id')
                        .eq('subject_id', movie.subject_id)
                        .maybeSingle();

                    if (!existing) {
                        // Insert real movie into DB
                        await supabase.from('custom_movies').insert({
                            title: movie.title,
                            poster_url: movie.cover,
                            subject_id: movie.subject_id,
                            language: movie.language || 'Hindi',
                            genre: category,
                            duration: duration,
                            is_auto_fetched: true,
                            watch_url: null 
                        });
                        console.log(`[Auto-Fetcher] Added: ${movie.title} (${category})`);
                    }
                }
            } catch (err) {
                console.error(`[Auto-Fetcher] Failed to fetch ${query}:`, err.message);
            }
        }
    }
    console.log('[Auto-Fetcher] Finished fetching movies.');
}

module.exports = { fetchAndSaveMovies };
