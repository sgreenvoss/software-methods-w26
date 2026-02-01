# Knowledge Base: SRS, SDS, Management Plan

## Sources
- `docs/DAWGZ SRS.docx` (SRS)
- `docs/DAGS - SDS.docx` (SDS)
- `docs/DAGS - Management Plan.docx` (Management Plan)

## System Overview (from SDS)
- Goal: group scheduling for Google users with shared availability, group membership, and meet-time petitions.
- Subsystems: frontend UI, backend services, and PostgreSQL database.
- Backend responsibilities: authentication, calendar retrieval, availability calculation, event creation/blocking, group management, and Google OAuth/Calendar API integration.

## SRS Summary
### Operational Features
- Google OAuth login, Google Calendar import, group creation + invites.
- Group availability view that supports priority-aware availability.
- Meet-time petitions with accept/reject workflow.
- Optional: time blocks + priority rules; stretch goals include other calendars and mobile UI.

### Use Cases (selected)
- User login and sign-up via Google OAuth.
- Import calendar and view events.
- Create groups, invite members, and view group availability.
- Petition a meet-time with notifications.

### Requirements (key points)
- Must: Google OAuth authentication + store user data; calendar import; personal calendar view; group management; group availability display; petition meet time.
- Could: add time blocks; add priority rules.
- Security/privacy: do not store user passwords; do not persist Google Calendar event data; do not share raw calendar event data across users; securely store OAuth tokens.
- Usability: follow WCAG 2.2, responsive UI, user testing after each sprint.
- Performance: under 1 second for queries at current scale (explicitly noted as evolving).
- Maintainability/testability: modular design, version control, documentation, frequent testing.

## Architecture Summary (from SDS)
Modules:
- Authentication: Google OAuth login and token handling.
- User Registry: store and retrieve user records.
- Group Manager: create/manage groups and membership.
- Calendar Retrieval: fetch Google Calendar events.
- Availability Calculator: compute group availability from events.
- Event Manager: manage time blocks and event creation.
- Petition Scheduler: manage meet-time proposals and responses.
- Persistent Storage: database layer.
- Interface: user-facing UI and input handling.

## Database (from SDS + repo schemas)
- Intended storage: user identities, groups, meet-time petitions, time blocks, scheduled events.
- SDS states: do not store raw Google Calendar event data; use transient retrieval.
- Repo schemas present:
  - `db/table_initialization.sql`
  - `db/calendar_sync_meta.sql`
  - `db/group_support.sql`

## Implementation Mapping (SDS -> current code)
- Authentication
  - `server/src/controllers/auth.controller.js`
  - `server/src/routes/auth.routes.js`
  - `server/src/services/googleCalendar.service.js`
  - `server/src/app.js` (route wiring + session)
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
  - `algorithm/` (availability logic and tests)
- Event Manager (partial)
  - `server/src/controllers/events.controller.js`
  - `server/src/routes/events.routes.js`
  - `server/src/models/cal_event.model.js`
- Petition Scheduler (not implemented in repo yet)
  - No code found; add module/service once requirements are finalized.
- Interface
  - `server/public/main.html`
  - `server/public/refresh.html`

## Management Plan Summary (from Management Plan)
- Roles:
  - Team Leader: David Haddad
  - Team Communicator: Stella Greenvoss
  - Project Master & QA Lead: Anna Norris
  - Project Delivery and Documentation Lead: Garrett Caldwell
  - Scrum Master: Anna Norris
- Cadence:
  - In-person meetings at least 3x/week
  - Longer meeting Tuesday for sprint planning/retrospective
  - Daily 15-minute scrum on other weekdays
- High-level schedule:
  - Weeks 1-3: planning + SRS/SDS/MP + presentation
  - Weeks 4-6: server-client, OAuth, calendar integration, DB foundations, UI
  - Weeks 7-9: algorithm priority integration, UI availability display, testing
  - Week 10: final review and submission
- Risks and mitigations:
  - Google API rate limits: degraded mode
  - OAuth complexity: narrow scope + token reuse
  - Time constraint: MVP-first approach
  - Data persistence: minimize sensitive storage + encryption
  - Scope creep: read-only calendar policy + defensive sync

## Gaps / Follow-ups
- Petition Scheduler, meet-time petitions, and time-block management are described in SDS but not yet fully implemented in repo.
- SRS requirements on email invites, priority rules, and time-block UI are not yet mapped to concrete endpoints or services.
