const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/feed', async (_req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const [banners, newlyAdded, topDownloaded, upcoming, topLikedSongs, recentMembers] =
            await Promise.all([
                supabase.from('banners').select('*').eq('is_active', true)
                    .order('display_order').limit(10),
                supabase.from('movies')
                    .select('id,title,poster_url,genre,rating,release_year,status,duration')
                    .eq('status', 'PUBLISHED')
                    .order('created_at', { ascending: false }).limit(15),
                supabase.from('movies')
                    .select('id,title,poster_url,rating,download_count')
                    .eq('status', 'PUBLISHED')
                    .order('download_count', { ascending: false }).limit(15),
                supabase.from('movies')
                    .select('id,title,poster_url,release_date,status')
                    .eq('status', 'UPCOMING')
                    .order('release_date', { ascending: true }).limit(15),
                supabase.from('songs')
                    .select('id,title,artist,artwork_url,like_count')
                    .eq('is_active', true)
                    .order('like_count', { ascending: false }).limit(15),
                supabase.from('profiles')
                    .select('id,nickname,avatar_url,membership_tier,membership_activated_at')
                    .eq('membership_status', 'ACTIVE')
                    .gte('membership_activated_at', sevenDaysAgo)
                    .order('membership_activated_at', { ascending: false }).limit(20),
            ]);
        res.json({
            banners: banners.data || [],
            newlyAdded: newlyAdded.data || [],
            topDownloaded: topDownloaded.data || [],
            upcoming: upcoming.data || [],
            topLikedSongs: topLikedSongs.data || [],
            recentMembers: recentMembers.data || [],
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
