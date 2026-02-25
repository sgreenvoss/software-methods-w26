module.exports = function registerGroupRoutes(app, { db }) {
  app.post("/group/creation", async (req, res) => {
    try {
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const groupName = typeof req.query.group_name === "string"
        ? req.query.group_name.trim()
        : "";
      if (!groupName) {
        return res.status(400).json({ success: false, error: "group_name is required" });
      }

      const group_id = await db.createGroupWithCreator(groupName, req.session.userId);
      return res.status(201).json({
        success: true,
        groupId: group_id,
        groupName,
        membershipAdded: true
      });
    } catch (error) {
      console.error("error creating group: ", error);
      return res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.get("/user/groups", async (req, res) => {
    try {
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const groups = await db.getGroupsByUID(req.session.userId);
      return res.status(201).json({
        success: true,
        groups
      });
    } catch (error) {
      console.error("error fetching groups:", error);
      return res.status(500).json({ error: "failed getting groups from db" });
    }
  });

  app.post("/group/leave", async (req, res) => {
    try {
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { groupId } = req.body;
      if (!groupId) {
        return res.status(400).json({ error: "No group to leave identified" });
      }

      db.leaveGroup(req.session.userId, groupId);
      return res.status(201).json({ success: true });
    } catch (error) {
      console.error("error leaving group", error);
      return res.status(400).json({ error: "something went wrong leaving group." });
    }
  });
};
