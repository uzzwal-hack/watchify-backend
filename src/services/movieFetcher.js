const axios = require('axios');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// Keywords to search for to fill categories
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
                // Search MovieBox
                const { data } = await axios.get(`${MOVIEBOX_API}/search`, {
                    params: { q: query },
                    timeout: 15000
                });

                const results = data?.results || [];
                
                // We only take the top 3 from each query to avoid duplicates
                const topResults = results.slice(0, 3);

                for (const movie of topResults) {
                    // Check if movie already exists in our DB by subject_id
                    const { data: existing } = await supabase
                        .from('custom_movies')
                        .select('id')
                        .eq('subject_id', movie.subject_id)
                        .maybeSingle();

                    if (!existing) {
                        // Insert the real movie into our database
                        await supabase.from('custom_movies').insert({
                            title: movie.title,
                            poster_url: movie.cover,
                            subject_id: movie.subject_id,
                            language: movie.language || 'Hindi',
                            genre: category,
                            is_auto_fetched: true,
                            watch_url: null // Link will be fetched live when user clicks Play
                        });
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
