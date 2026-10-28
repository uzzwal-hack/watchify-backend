const axios = require('axios');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// We add a new search category for Music Videos / Lyrics
const CATEGORY_SEARCHES = {
    'Bollywood': ['Bollywood', 'Hindi Movie', 'Dhurandhar', 'Jawan'],
    'Anime': ['Anime', 'Naruto', 'One Piece'],
    'Hollywood': ['Hollywood', 'Marvel', 'Avatar'],
    'Romance': ['Romance', 'Romantic Movie'],
    'Music Videos': ['Lyrical Video', 'Song', 'Music Video'] // NEW CATEGORY
};

async function fetchAndSaveMovies() {
    console.log('[Auto-Fetcher] Starting fetch...');
    
    for (const [category, queries] of Object.entries(CATEGORY_SEARCHES)) {
        for (const query of queries) {
            try {
                const { data } = await axios.get(`${MOVIEBOX_API}/search`, {
                    params: { q: query },
                    timeout: 15000
                });

                const results = data?.results || [];
                
                for (const movie of results) {
                    const duration = movie.duration || 0;
                    
                    // 🚨 DURATION LOGIC
                    if (category === 'Music Videos') {
                        // Music videos should be SHORT (less than 20 mins)
                        if (duration > 1200) continue; 
                    } else {
                        // Movies should be LONG (more than 20 mins)
                        if (duration > 0 && duration < 1200) continue;
                    }

                    const { data: existing } = await supabase
                        .from('custom_movies')
                        .select('id')
                        .eq('subject_id', movie.subject_id)
                        .maybeSingle();

                    if (!existing) {
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
                console.error(`[Auto-Fetcher] Failed for ${query}:`, err.message);
            }
        }
    }
}

module.exports = { fetchAndSaveMovies };
