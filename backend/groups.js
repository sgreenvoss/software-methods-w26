/*
expecting username or email
if user enters group creation:
  chooses users to invite to group
  clicks a finalize button that will then generate a group id and send invitations
  invitations are sent via email that include an invitation link
  user will see who has joined the group
  user can leave group

invitee
  receives an invitation to join a group via email
  clicks on the invitation link
  if an existing user, logs into their account and goes to confirmation page
  if a new user, creates account and goes to confirmation page
  confirmation page: displays agree and reject options for users
  if agree:
    add group id to user, user id to group
    user can now view available times
*/
const { randomUUID } = require("crypto");
const db = require("./db/index");
const { getgroups } = require("process");
const emailer = require("./emailer");
const inviteToken = require("./inviteToken");

module.exports = function(app) {
  async function resolveGroupInvite(req) {
    if (!req.session.pendingGroupToken) return null;
    
    const result = inviteToken.verifyInviteToken(req.session.pendingGroupToken);
    if (!result.valid) return null;
    
    await db.addUserToGroup(result.groupId, req.session.userId);
    delete req.session.pendingGroupToken;
    return result.groupId;
  }

  app.post("/group/creation", async (req, res) => {
    try {
      // ensure user is logged in
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const {group_name} = req.query;
      console.log("group name is ", group_name);
      // store group id in database with creator's user id
      const group_id = await db.createGroup(group_name); //await createGroupId();
      await db.addUserToGroup(group_id, req.session.userId);
      return res.status(201).json({
        success: true,
        groupId: group_id,
        groupName: group_name
      });
    } catch(error) {
      console.error("error creating group: ", error);
      return res.status(500).json({error: "Failed to create group"});
    }
  });

  app.get("/user/groups", async (req, res) => {
    // ensure user is logged in
    try{
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // query database for groups that include user's id
      // return list of groups to frontend
      const groups = await db.getGroupsByUID(req.session.userId);
      return res.status(201).json({
        success:true,
        groups:groups
      });
    } catch(error) {
      console.error("error fetching groups:", error);
      return res.status(500).json({error: "failed getting groups from db"});
    }

  });

  app.post("/group/invite", async (req, res) => {
    // ensure user is logged in
    if (!req.session.userId || !req.session.isAuthenticated) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const groupId = req.body.group_id;
      // verify that user is a member of the group
      if (await db.isUserInGroup(req.session.userId, groupId)) {
        // generate invitation link with group id to display on frontend
        const date = Date.now() + 24 * 60 * 60 * 1000;
        const token = inviteToken.createInviteToken({groupId, expiresAtMs: date});
        let url = process.env.FRONTEND_URL + `/group/respond-invitation?q=${token}`;        
        console.log("shareable link:", url);
        return res.status(201).json({invite: url});
      } else {
        return res.status(401).json({error: "User is not a member of that group."});
      }
    } catch(error) {
      console.error("error with inviting:", error);
      return res.status(500).json({error: "failed creating invite link."});
    }
  });

  app.get("/group/respond-invitation", async (req, res) => {
    // get token out of url, save in session.
    const {q} = req.query;
    const result = inviteToken.verifyInviteToken(q);
    if (!result.valid) {
      return res.status(401).json({error: "Bad invite token"});
    }
    req.session.pendingGroupToken = q;
    // if user is not logged in, redirect to login, then go back here
    if (!req.session.userId || !req.session.isAuthenticated) {
      // i think here we should force a session save (because of the session loss issues with oauth)
      await new Promise((resolve, reject) => {
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session Save Error:", saveErr);
            reject(saveErr);
          } else {
            resolve();
          }
        });
      });
      console.log("redirecting now");
      return res.redirect('/login'); // TODO: redirect to a signup page
    }
    // if we hit here, the user already has an account.
    // for now let's assume that clicking the link = accepting being
    // in the group.
    await resolveGroupInvite(req);
    res.redirect('/');
  });

  app.post("/group/leave", async (req, res) => {
    // ensure user is logged in
    try {
      if (!req.session.userId || !req.session.isAuthenticated) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const {groupId} = req.body;
      console.log("this is the groupid:", groupId);

      if (!groupId) {
        return res.status(400).json({error: "No group to leave identified"});
      }
      db.leaveGroup(req.session.userId, groupId);
      return res.status(201).json({success:true});
      // get group id from request body
      // remove user id from group's list of members in database
      // remove group id from user's list of groups in database

    } catch (error) {
      console.error("error leaving group ", error);
      return res.status(400).json({error: "something went wrong leaving group."});
    }
  });
}
