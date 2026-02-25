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
const db = require("./db/dbInterface");
const inviteToken = require("./inviteToken");
const registerGroupRoutes = require("./routes/group_routes");
const registerInviteRoutes = require("./routes/invite_routes");
const { createInviteStateService } = require("./services/invite_state_service");

module.exports = function(app) {
  const inviteState = createInviteStateService({
    isProduction: process.env.NODE_ENV === "production"
  });

  /*
    Route visibility map (modular source of truth):
    - Group routes: ./routes/group_routes
      - Includes group details endpoint (/group/:groupId) [GCAVAILVIEW]
    - Invite routes: ./routes/invite_routes
      - Includes invite entry (/group/respond-invitation) and modal APIs
  */
  registerGroupRoutes(app, { db });
  registerInviteRoutes(app, { db, inviteToken, inviteState });
};
