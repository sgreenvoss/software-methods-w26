/*
File: group_routes.js
Purpose: Registers the backend group routes.
    This file handles group creation, listing, details, and leaving a group.
Date Created: 2026-02-23
Initial Author(s): David Haddad

System Context:
Interacts with frontend via Express routes to handle operations that
support frontend Groups UI flows.
*/

module.exports = function registerGroupRoutes(app, { db }) {
  // Create a new group and add the current user as the first member.
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

  // Return the groups tied to the current authenticated user.
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

  // Return one group's metadata plus the current member list.
  app.get("/group/:groupId(\\d+)", async (req, res) => {
    try {
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const groupId = req.params.groupId;
      const groupInfo = await db.getGroupByID(groupId);
      const members = await db.getGroupMembersByID(groupId);
      return res.status(200).json({
        success: true,
        group: groupInfo,
        members
      });
    } catch (error) {
      console.error("error fetching group details:", error);
      return res.status(500).json({ error: "failed getting group details from db" });
    }
  });

  // Remove the current user from the selected group.
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
