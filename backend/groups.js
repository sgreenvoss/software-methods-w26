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

module.exports = function(app) {
  async function createGroupId() {
    // on the db end the group id is an automatically generated int - 
    // is there a security reason to use this instead? 
    const groupId = randomUUID();
    // ensure groupId is unique in database
    // generate a new id if not unique
    return groupId;
  }

  app.post("/group/creation", async (req, res) => {
    // ensure user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const {group_name} = req.query;
    console.log("group name is ", group_name);
    // create group id
    const groupId = db.createGroup(group_name); //await createGroupId();
    console.log(groupId);
    // store group id in database with creator's user id
  });

  app.get("/user/groups", async (req, res) => {
    // ensure user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // query database for groups that include user's id
    // return list of groups to frontend
  });

  app.post("/group/invite", async (req, res) => {
    // ensure user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // get group id and invitee email from request body
    // verify that user is a member of the group
    // generate invitation link with group id to display on frontend
  });

  app.post("/group/respond-invitation", async (req, res) => {
    // ensure user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // get group id and response (accept/reject) from request body
    // if accept:
    //   add group id to user's list of groups in database
    //   add user id to group's list of members in database
    // if reject:
    //   do not add user to group
  });

  app.post("/group/leave", async (req, res) => {
    // ensure user is logged in
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    // get group id from request body
    // remove user id from group's list of members in database
    // remove group id from user's list of groups in database
  });
};
