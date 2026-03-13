/*
File: invite_state_service.js
Purpose: Stores the pending invite token in both the session and a signed cookie.
    This keeps invite links working across login redirects.
Date Created: 2026-02-23
Initial Author(s): David Haddad

System Context:
Provides invite-token continuity across authentication boundaries. Invite routes use this service
to persist a pending group-invite token in both the session and a signed cookie so users who click
an invite link before logging in can complete auth and still join the intended group.
*/

/**
 * Creates a service for storing and restoring pending invite tokens across session transitions.
 *
 * @param {Object} [options={}] - Service configuration
 * @param {boolean} [options.isProduction=process.env.NODE_ENV === "production"] - Enables secure cookies in production
 * @param {string} [options.cookieName="pending_group_invite"] - Signed cookie key used to mirror pending invite token
 * @param {number} [options.maxAgeMs=86400000] - Cookie max age in milliseconds
 * @returns {{Object}} Invite state service API
 */
function createInviteStateService({
  isProduction = process.env.NODE_ENV === "production",
  cookieName = "pending_group_invite",
  maxAgeMs = 24 * 60 * 60 * 1000
} = {}) {
  // Mirror the auth check used by the invite routes.
  /**
   * Checks whether the current request has an authenticated session.
   *
   * @param {Object} req - Express request object
   * @returns {boolean} True when request session is authenticated
   */
  function isAuthenticated(req) {
    return Boolean(req.session.userId && req.session.isAuthenticated);
  }

  /**
   * Persists the current session and exposes callback completion as a Promise.
   *
   * @param {Object} req - Express request object containing session
   * @returns {Promise<void>} Resolves when session save succeeds
   */
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

  /**
   * Builds cookie options used when setting/clearing invite-token cookies.
   *
   * @param {boolean} [includeMaxAge=true] - Whether to include cookie maxAge
   * @returns {Object} Cookie option object
   */
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

  /**
   * Stores pending invite token in session and signed cookie, then saves session.
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {string} token - Pending invite token
   * @returns {Promise<void>} Resolves after token is persisted
   */
  async function setPendingInvite(req, res, token) {
    // Save the token in both places before the user is redirected.
    req.session.pendingGroupToken = token;
    res.cookie(cookieName, token, cookieOptions());
    await saveSession(req);
  }

  /**
   * Retrieves pending invite token from session, falling back to signed cookie when needed.
   * Restores cookie token back into session when found.
   *
   * @param {Object} req - Express request object
   * @returns {Promise<string|null>} Pending invite token or null when absent
   */
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

  /**
   * Clears pending invite token from session and signed cookie, then saves session.
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>} Resolves after token is fully cleared
   */
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
