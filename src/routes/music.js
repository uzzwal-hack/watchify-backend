const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/authGuard');
const supabase = require('../lib/supabase');
const { JioSaavnClient } = require('jiosaavn-api-client');

// Initialize the JioSaavn client
const jioClient = new JioSaavnClient();

// 1. SEARCH ROUTE (Using JioSaavn for full Indian catalog)
router.get('/search', requireAuth, async (req, res) => {
    const query = String(req.query.query || '').trim();
    if (!query) return res.status(400).json({ error: 'query required' });

    try {
        console.log('Searching JioSaavn for:', query);
        
        // Search for songs on JioSaavn
        const searchResult = await jioClient.searchSongs({
            query: query,
            limit: 15
        });

        if (!searchResult.success) {
            throw new Error(searchResult.message || 'JioSaavn search failed');
        }

        // Map JioSaavn results to the format your Android app expects
        const results = searchResult.data.results.map((song) => ({
            id: song.id,
            title: song.title,
            artist: song.artistNames ? song.artistNames.join(', ') : 'Unknown Artist',
            thumbnail: song.images?.[0]?.url || null,
            // We store the JioSaavn song ID to fetch the stream later
            permalink_url: `jiosaavn:${song.id}`,
            duration: (song.durationSeconds || 0) * 1000
        }));

        return res.json({ ok: true, results });
    } catch (error) {
        console.error('SEARCH ERROR:', error.message);
        return res.status(502).json({ error: 'search failed', detail: error.message });
    }
});

// 2. STREAM ROUTE (Fetches the full 320kbps link from JioSaavn)
router.get('/stream', async (req, res) => {
    const source = String(req.query.url || '').trim();
    if (!source) return res.status(400).json({ error: 'url required' });

    try {
        let songId = null;

        // Extract the JioSaavn song ID from our custom permalink
        if (source.startsWith('jiosaavn:')) {
            songId = source.replace('jiosaavn:', '');
        } else {
            // Fallback: If it's a raw string, search for it (for legacy reasons)
            const searchResult = await jioClient.searchSongs({ query: source, limit: 1 });
            if (searchResult.success && searchResult.data.results.length > 0) {
                songId = searchResult.data.results[0].id;
            }
        }

        if (!songId) return res.status(404).json({ error: 'Track not found' });

        console.log('Fetching full JioSaavn stream for ID:', songId);

        // Get the full song details (which includes the decrypted download links)
        const songDetails = await jioClient.getSongsById({ ids: [songId] });
        
        if (!songDetails.success || !songDetails.data[0]) {
            return res.status(404).json({ error: 'Could not fetch song details' });
        }

        const song = songDetails.data[0];
        
        // Find the highest quality download link (320kbps)
        // JioSaavn returns an array of links, usually sorted by quality.
        let bestAudioUrl = null;
        if (song.downloadLinks && song.downloadLinks.length > 0) {
            // Sort by bitrate descending to get 320kbps
            const sortedLinks = song.downloadLinks.sort((a, b) => b.bitrate - a.bitrate);
            bestAudioUrl = sortedLinks[0].url;
        }

        if (!bestAudioUrl) {
            return res.status(404).json({ error: 'No playable stream URL found' });
        }

        console.log('Found JioSaavn MP3:', bestAudioUrl);
        
        if (req.query.json === 'true') {
            return res.json({ ok: true, stream_url: bestAudioUrl });
        }
        return res.redirect(bestAudioUrl);

    } catch (error) {
        console.error('STREAM ERROR:', error.message);
        return res.status(502).json({ error: 'stream failed', detail: error.message });
    }
});

// 3. WEEKLY CATALOG (Keep this as is)
router.get('/weekly', async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('weekly_catalog')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        return res.json({ ok: true, results: data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
