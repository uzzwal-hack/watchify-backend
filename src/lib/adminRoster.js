const FIXED = {
    'raghavendrasingh7388@gmail.com': { displayName: 'Ujjwal',  role: 'MODERATOR' },
    'ankitsimraha@gmail.com':         { displayName: 'Ankit',   role: 'SENIOR_ADMIN' },
    'malikzunaid884@gmail.com':       { displayName: 'Junaid',  role: 'SENIOR_ADMIN' },
};

function roleFor(email) {
    return FIXED[(email || '').toLowerCase()]?.role || 'USER';
}
function isFixedAccount(email) {
    return !!FIXED[(email || '').toLowerCase()];
}
function displayNameFor(email) {
    return FIXED[(email || '').toLowerCase()]?.displayName || null;
}
module.exports = { FIXED, roleFor, isFixedAccount, displayNameFor };
