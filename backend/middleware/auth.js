// // middleware/auth.js
// const requireAuth = (req, res, next) => {
//   if (!req.session || !req.session.userId) {
//     return res.status(401).json({ error: 'Please log in' });
//   }
//   next();
// };

// const requireCalendarAccess = (req, res, next) => {
//   if (!req.session || !req.session.tokens) {
//     return res.status(401).json({ error: 'Please connect your Google Calendar' });
//   }
//   next();
// };

// module.exports = { requireAuth, requireCalendarAccess };