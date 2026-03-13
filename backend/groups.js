/*
File: groups.js
Purpose: Registers the group, invite, and petition route modules.
    This file keeps the backend group features wired together in one place.
Date Created: 2026-02-09
Initial Author(s): Anna Norris, Stella Greenvoss

System Context:
Handles the routes associated with groups. Originally was a separate file
with the endpoints for groups.
*/
const db = require("./db/dbInterface");
const inviteToken = require("./inviteToken");
const registerGroupRoutes = require("./routes/group_routes");
const registerInviteRoutes = require("./routes/invite_routes");
const registerPetitionRoutes = require("./routes/petition_routes");
const { createInviteStateService } = require("./services/invite_state_service");

module.exports = function(app) {
  const inviteState = createInviteStateService({
    isProduction: process.env.NODE_ENV === "production"
  });

  /*
  Route visibility map for the group feature modules.
  Group routes handle membership and group details.
  Invite routes handle invite links, email sends, and pending-invite state.
  */
  registerGroupRoutes(app, { db });
  registerInviteRoutes(app, { db, inviteToken, inviteState });
  registerPetitionRoutes(app, { db });
};
