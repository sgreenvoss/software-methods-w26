const { oauth2Client } = require('../config/google');
const db = require('../db');

async function ensureValidToken(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await db.getUserByID(req.session.userId);
    const now = Date.now();
    const expiry = Number(user.token_expiry);
    
    const fiveMins = 5 * 60 * 1000;
    if (!expiry || now >= (expiry - fiveMins)) {
      oauth2Client.setCredentials({ refresh_token: user.refresh_token });
      const { credentials } = await oauth2Client.refreshAccessToken();
      await db.updateTokens(req.session.userId, credentials.access_token, credentials.expiry_date);
    }
    next();
  } catch (error) {
    res.status(401).json({ error: "Token refresh failed" });
  }
}

module.exports = { ensureValidToken };