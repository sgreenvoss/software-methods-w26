function createInviteStateService({
  isProduction = process.env.NODE_ENV === "production",
  cookieName = "pending_group_invite",
  maxAgeMs = 24 * 60 * 60 * 1000
} = {}) {
  function isAuthenticated(req) {
    return Boolean(req.session.userId && req.session.isAuthenticated);
  }

  function saveSession(req) {
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
    req.session.pendingGroupToken = token;
    res.cookie(cookieName, token, cookieOptions());
    await saveSession(req);
  }

  async function getPendingInviteToken(req) {
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
