module.exports = function registerInviteRoutes(app, { db, inviteToken, inviteState }) {
  app.post("/group/invite", async (req, res) => {
    if (!inviteState.isAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const groupId = req.body.group_id;
      if (await db.isUserInGroup(req.session.userId, groupId)) {
        const expiresAtMs = Date.now() + 24 * 60 * 60 * 1000;
        const token = inviteToken.createInviteToken({ groupId, expiresAtMs });
        const url = process.env.FRONTEND_URL + `/group/respond-invitation?q=${token}`;
        return res.status(201).json({ invite: url });
      }

      return res.status(401).json({ error: "User is not a member of that group." });
    } catch (error) {
      console.error("error with inviting:", error);
      return res.status(500).json({ error: "failed creating invite link." });
    }
  });

  app.get("/group/respond-invitation", async (req, res) => {
    const { q } = req.query;
    const result = inviteToken.verifyInviteToken(q);
    if (!result.valid) {
      return res.status(401).json({ error: "Bad invite token" });
    }

    try {
      await inviteState.setPendingInvite(req, res, q);
    } catch (saveErr) {
      console.error("Session save error while storing pending invite:", saveErr);
      return res.status(500).json({ error: "Failed to persist invite state" });
    }

    if (!inviteState.isAuthenticated(req)) {
      return res.redirect("/login");
    }

    return res.redirect("/");
  });

  app.get("/api/group-invite/pending", async (req, res) => {
    try {
      if (!inviteState.isAuthenticated(req)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const token = await inviteState.getPendingInviteToken(req);
      if (!token) {
        return res.status(200).json({ ok: true, hasPendingInvite: false });
      }

      const decoded = inviteToken.verifyInviteToken(token);
      if (!decoded.valid) {
        await inviteState.clearPendingInvite(req, res);
        return res.status(200).json({ ok: true, hasPendingInvite: false });
      }

      if (await db.isUserInGroup(req.session.userId, decoded.groupId)) {
        await inviteState.clearPendingInvite(req, res);
        return res.status(200).json({ ok: true, hasPendingInvite: false });
      }

      const group = await db.getGroupById(decoded.groupId);
      if (!group) {
        await inviteState.clearPendingInvite(req, res);
        return res.status(200).json({ ok: true, hasPendingInvite: false });
      }

      return res.status(200).json({
        ok: true,
        hasPendingInvite: true,
        invite: {
          groupId: decoded.groupId,
          groupName: group.group_name,
          expiresAtMs: decoded.expiresAtMs
        }
      });
    } catch (error) {
      console.error("error fetching pending invite:", error);
      return res.status(500).json({ ok: false, error: "Failed to fetch pending invite" });
    }
  });

  app.post("/api/group-invite/respond", async (req, res) => {
    try {
      if (!inviteState.isAuthenticated(req)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const { decision } = req.body || {};
      if (decision !== "accept" && decision !== "decline") {
        return res.status(400).json({ ok: false, error: "decision must be 'accept' or 'decline'" });
      }

      const token = await inviteState.getPendingInviteToken(req);
      if (!token) {
        return res.status(400).json({ ok: false, error: "No pending invite" });
      }

      const decoded = inviteToken.verifyInviteToken(token);
      if (!decoded.valid) {
        await inviteState.clearPendingInvite(req, res);
        return res.status(400).json({ ok: false, error: "Invite expired or invalid" });
      }

      if (decision === "accept") {
        await db.addUserToGroup(decoded.groupId, req.session.userId);
      }

      await inviteState.clearPendingInvite(req, res);
      return res.status(200).json({
        ok: true,
        decision,
        groupId: decoded.groupId
      });
    } catch (error) {
      console.error("error responding to invite:", error);
      return res.status(500).json({ ok: false, error: "Failed to process invite decision" });
    }
  });

  // Legacy endpoint left in place to avoid breaking callers.
  app.get('/api/groups/join', async (req, res) => {
    try {
      const decoded = inviteToken.verifyInviteToken(req.query.token);
      return res.status(200).json({ success: true, decoded });
    }
    catch (error) {
      return res.status(500).json({ error: "Failed to join group" });
    }
  });
};
