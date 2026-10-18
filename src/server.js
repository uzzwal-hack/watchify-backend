require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true, t: Date.now() }));

app.use('/api/home',         rateLimit({ windowMs: 60_000, max: 60 }),  require('./routes/home'));
app.use('/api/chat',         rateLimit({ windowMs: 60_000, max: 120 }), require('./routes/chat'));
app.use('/api/music',        rateLimit({ windowMs: 60_000, max: 60 }),  require('./routes/music'));
app.use('/api/metadata',     rateLimit({ windowMs: 60_000, max: 30 }),  require('./routes/metadata'));
app.use('/api/movies',       rateLimit({ windowMs: 60_000, max: 60 }),  require('./routes/movies'));
app.use('/api/link-checker', rateLimit({ windowMs: 60_000, max: 10 }),  require('./routes/linkChecker'));
app.use('/api/support',      rateLimit({ windowMs: 60_000, max: 60 }),  require('./routes/support'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Watchify backend on :${port}`);
    require('./services/linkCheckerCron').startLinkCheckerCron();
});
