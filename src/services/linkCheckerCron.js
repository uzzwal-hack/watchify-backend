const cron = require('node-cron');
const { runOnce } = require('./linkChecker');

function startLinkCheckerCron() {
    cron.schedule('0 */6 * * *', async () => {
        console.log('[link-checker] start');
        try { await runOnce(); } catch (e) { console.error(e); }
        console.log('[link-checker] done');
    });
}
module.exports = { startLinkCheckerCron };
