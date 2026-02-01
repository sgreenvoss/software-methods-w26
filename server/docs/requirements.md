# Requirements (SRS) Checklist

Source: `docs/DAWGZ SRS.docx`

## Functional Requirements
- [ ] 2.1.1 User Authentication (Google OAuth) (Must) — Owner: David Haddad
- [ ] 2.1.2 Calendar Import Interface (Must) — Owner: Anna Norris
- [ ] 2.1.3 Personal Calendar View (Must) — Owner: Garrett Caldwell
- [ ] 2.1.4 Group Management (Must) — Owner: Garrett Caldwell
- [ ] 2.1.5 Group Availability Display (Must) — Owner: Garrett Caldwell
- [ ] 2.1.6 Petition Meet Time (Must) — Owner: Garrett Caldwell
- [ ] 2.1.7 Add Time Block (Could) — Owner: David Haddad
- [ ] 2.1.8 Add Priority Rule (Could) — Owner: David Haddad

## Functional Behaviors
- [ ] 2.2.1 User Authentication — validate OAuth, store user identifiers in DB, handle auth errors
- [ ] 2.2.2 Calendar Processing — fetch on demand, compute availability, do not store raw calendar data
- [ ] 2.2.3 Time Selection — propose meet times, validate availability, accept/reject invites

## Usability
- [ ] 2.3 Usability — WCAG 2.2 compliance; responsive UI; sprint user testing

## Performance
- [ ] 2.4 Performance — target <1s query latency at current scale

## System Attributes
- [ ] 2.5.1 Security & Privacy — secure token storage; no passwords; no persistent calendar data; no sharing raw events
- [ ] 2.5.2 Maintainability — modular design; version control; documentation; keep README current
- [ ] 2.5.3 Testability — tests developed with code; no week without tests
