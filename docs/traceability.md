# Traceability (SRS/SDS -> Code)

## Module-to-Code Mapping (from SDS)
- Authentication
  - `server/src/controllers/auth.controller.js`
  - `server/src/routes/auth.routes.js`
  - `server/src/services/googleCalendar.service.js`
  - `server/src/app.js`
- User Registry
  - `server/src/models/person.model.js`
  - `server/src/controllers/people.controller.js`
  - `server/src/routes/people.routes.js`
- Group Manager
  - `server/src/models/group.model.js`
  - `server/src/models/group_match.model.js`
  - `server/src/controllers/groups.controller.js`
  - `server/src/routes/groups.routes.js`
- Calendar Retrieval
  - `server/src/services/googleCalendar.service.js`
  - `server/src/services/calendarCache.service.js`
- Availability Calculator
  - `server/src/services/availability.service.js`
  - `server/src/services/groupAvailability.service.js`
  - `algorithm/`
- Event Manager (partial)
  - `server/src/controllers/events.controller.js`
  - `server/src/routes/events.routes.js`
  - `server/src/models/cal_event.model.js`
- Petition Scheduler
  - Not implemented; create `server/src/services/petitionScheduler.service.js` (planned)
- Interface
  - `server/public/main.html`
  - `server/public/refresh.html`

## Requirement Traceability
### SRS Requirements (key) -> Code Mapping
- 2.1.1 User Authentication (Must)
  - OAuth flow: `server/src/controllers/auth.controller.js`, `server/src/routes/auth.routes.js`, `server/src/services/googleCalendar.service.js`, `server/src/app.js`
  - User persistence: `server/src/models/person.model.js` (note: currently not wired into OAuth flow)
- 2.1.2 Calendar Import Interface (Must)
  - `server/src/services/googleCalendar.service.js`, `server/src/services/calendarCache.service.js`, `server/src/controllers/events.controller.js`
- 2.1.3 Personal Calendar View (Must)
  - UI: `server/public/refresh.html` (API-driven tools); no dedicated calendar view yet
- 2.1.4 Group Management (Must)
  - `server/src/controllers/groups.controller.js`, `server/src/models/group.model.js`, `server/src/models/group_match.model.js`, `server/src/routes/groups.routes.js`
- 2.1.5 Group Availability Display (Must)
  - API: `server/src/services/groupAvailability.service.js`, `server/src/routes/availability.routes.js` (UI not implemented)
- 2.1.6 Petition Meet Time (Must)
  - Not implemented (needs petition scheduler + invite workflow)
- 2.1.7 Add Time Block (Could)
  - Partial storage via `server/src/models/cal_event.model.js` (no UI + API endpoint for user-defined blocks yet)
- 2.1.8 Add Priority Rule (Could)
  - Not implemented (requires rule model, storage, and availability integration)

### SRS System Attributes (summary)
- Security/privacy: tokens securely stored; no passwords; no persistent Google event storage; no sharing raw events.
- Maintainability/testability: modular design + version control + documentation + frequent tests.
