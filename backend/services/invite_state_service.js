/*
File: invite_state_service.js
Purpose: Stores the pending invite token in both the session and a signed cookie.
    This keeps invite links working across login redirects.
*/

function createInviteStateService({
  isProduction = process.env.NODE_ENV === "production",
  cookieName = "pending_group_invite",
  maxAgeMs = 24 * 60 * 60 * 1000
} = {}) {
  // Mirror the auth check used by the invite routes.
  function isAuthenticated(req) {
    return Boolean(req.session.userId && req.session.isAuthenticated);
  }

  function saveSession(req) {
    // Wrap the session callback API so the routes can await persistence.
    return new Promise((resolve, reject) => {
      req.session.save((saveErr) => {
        if (saveErr) {
          reject(saveErr);
        } else {
          resolve();
        }
      });
    });
  }

  function cookieOptions(includeMaxAge = true) {
    // Build one cookie option object so set and clear stay in sync.
    const base = {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/"
    };

    if (includeMaxAge) {
      base.maxAge = maxAgeMs;
    }

    return base;
  }

  async function setPendingInvite(req, res, token) {
    // Save the token in both places before the user is redirected.
    req.session.pendingGroupToken = token;
    res.cookie(cookieName, token, cookieOptions());
    await saveSession(req);
  }

  async function getPendingInviteToken(req) {
    // Restore the token from the signed cookie when the session was recreated.
    if (req.session.pendingGroupToken) {
      return req.session.pendingGroupToken;
    }

    const cookieToken = req.signedCookies
      ? req.signedCookies[cookieName]
      : null;
    if (!cookieToken) return null;

    req.session.pendingGroupToken = cookieToken;
    await saveSession(req);
    return cookieToken;
  }

  async function clearPendingInvite(req, res) {
    // Remove the token from both storage layers once the invite is handled.
    delete req.session.pendingGroupToken;
    res.clearCookie(cookieName, cookieOptions(false));
    await saveSession(req);
  }

  return {
    cookieName,
    isAuthenticated,
    setPendingInvite,
    getPendingInviteToken,
    clearPendingInvite
  };
}

module.exports = {
  createInviteStateService
};
