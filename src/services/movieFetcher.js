const axios = require('axios');
const supabase = require('../lib/supabase');

const MOVIEBOX_API = 'https://movieboxapi-v2ne.onrender.com';

// The massive catalog you provided
const media_catalog = {
    'Bollywood': [
        'Jawan', 'Animal', 'Pathaan', 'Dunki', 'Dangal', 
        '3 Idiots', 'Dhurandhar', 'Stree 2', 'Bajrangi Bhaijaan', 
        'Secret Superstar', 'Gadar 2', 'PK', 'Sanju'
    ],
    'Hollywood': [
        'Avatar', 'Deadpool', 'Inception', 'Interstellar', 'The Batman', 
        'Oppenheimer', 'Avengers: Endgame', 'Titanic', 'Avatar: The Way of Water', 
        'Star Wars: The Force Awakens', 'Jurassic World', 'Top Gun: Maverick'
    ],
    'Anime': [
        'Naruto', 'One Piece', 'Demon Slayer', 'Jujutsu Kaisen', 'Attack on Titan',
        'Spirited Away', 'Your Name', 'Suzume', 'Dragon Ball Super: Broly', 
        'Death Note', 'Bleach'
    ],
    'South Movies': [
        'RRR', 'KGF', 'Pushpa', 'Baahubali', 'Kantara',
        'Kalki 2898 AD', 'Baahubali 2: The Conclusion', 'KGF: Chapter 2', 
        'Salaar: Part 1 – Ceasefire', 'Jailer', 'Leo', 'Vikram'
    ],
    'Romance': [
        'Titanic', 'The Notebook', 'La La Land', 'Fifty Shades', 'After',
        'Me Before You', 'Pride & Prejudice', 'A Star Is Born', 
        'Crazy Rich Asians', 'Before Sunrise', 'Fault in Our Stars'
    ],
    'Teenage Love': [
        'To All the Boys', 'The Kissing Booth', 'The Summer I Turned Pretty', 'XO Kitty',
        'Heartstopper', 'Never Have I Ever', 'Love, Simon', 
        '10 Things I Hate About You', 'The Fault in Our Stars', 'Sex Education'
    ],
    'Web Series': [
        'Money Heist', 'Squid Game', 'Stranger Things', 'Breaking Bad', 'Wednesday',
        'Game of Thrones', 'The Last of Us', 'The Boys', 'Chernobyl', 
        'Dark', 'Succession'
    ],
    'Sci-Fi': [
        'Interstellar', 'Inception', 'Dune: Part Two', 'The Matrix', 
        'Blade Runner 2049', 'Black Mirror', 'Dark', 'Severance'
    ],
    'Horror & Thriller': [
        'It', 'The Conjuring', 'A Quiet Place', 'Get Out', 
        'Hereditary', 'The Haunting of Hill House', 'Shutter Island', 'Gone Girl'
    ],
    'Crime & Gangster': [
        'The Godfather', 'Goodfellas', 'Scarface', 'Pulp Fiction', 
        'Peaky Blinders', 'Narcos', 'Mirzapur', 'Sacred Games', 'The Sopranos'
    ],
    'Superhero': [
        'Avengers: Endgame', 'Spider-Man: No Way Home', 'The Dark Knight', 
        'Deadpool & Wolverine', 'Black Panther', 'The Boys', 'Invincible', 'Daredevil'
    ],
    'K-Drama': [
        'Crash Landing on You', 'The Glory', 'All of Us Are Dead', 
        'Vincenzo', 'Goblin (Guardian)', 'Itaewon Class', 'Queen of Tears'
    ],
    // 🚨 NEW CATEGORY: STRICTLY HINDI MUSIC VIDEOS
    'Music Videos': [
        'Hindi Song', 'Bollywood Song', 'Hindi Lyrical Video', 
        'Arijit Singh Song', 'Neha Kakkar Song', 'Pritam Song',
        'Latest Hindi Song', 'Trending Bollywood Song'
    ]
};
    
async function fetchAndSaveMovies() {
    console.log('[Auto-Fetcher] Starting massive catalog fetch...');
    
    for (const [category, queries] of Object.entries(media_catalog)) {
        for (const query of queries) {
            try {
                const { data } = await axios.get(`${MOVIEBOX_API}/search`, {
                    params: { q: query },
                    timeout: 15000
                });

                const results = data?.results || [];
                
                // Take the top 2 results for each specific movie to avoid duplicates
                for (const movie of results.slice(0, 2)) {
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
                            genre: category, // Saves as 'K-Drama', 'Sci-Fi', etc.
                            is_auto_fetched: true,
                            watch_url: null 
                        });
                    }
                }
            } catch (err) {
                console.error(`[Auto-Fetcher] Failed for ${query}:`, err.message);
            }
        }
    }
    console.log('[Auto-Fetcher] Finished fetching massive catalog.');
}

module.exports = { fetchAndSaveMovies };
