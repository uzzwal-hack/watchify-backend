const { createClient } = require('@supabase/supabase-js');
module.exports = createClient(
    process.env.SUPABASE_URL || 'https://rjkmafqonlrhaaonpftx.supabase.co',
    process.env.SUPABASE_SECRET_KEY || 'sb_secret_dummy',
    { auth: { persistSession: false } }
);
