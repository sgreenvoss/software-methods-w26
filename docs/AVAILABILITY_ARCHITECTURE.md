# Group Availability Architecture 🦆

## 0. API Integration (Layer 1)
- Endpoint: GET /api/groups/:groupId/availability
- Query Params: windowStartMs (int), windowEndMs (int), granularityMinutes (int)
- Returns: JSON payload with `ok`, `groupId`, `windowStartMs`, `windowEndMs`, and `availability`.
- `availability` is an array of blocks: `{ start, end, count, availabilityFraction, totalCount }`.
- `count` is mapped from the algorithm's `StrictView.availableCount`.
- Runtime multi-view keys in algorithm output are `StrictView`, `FlexibleView`, and `LenientView`.

## 1. Overview
We have adopted a **Service-Oriented MVC** pattern to manage the complexity of the group availability heatmap. This separates the "How" (Algorithm) from the "Who" (Controller) and the "What" (Service).

## 2. The Three-Layer Defense (Ch. 6: Modularity)

### 🟢 Layer 1: The Controller (`controllers/availabilityController.js`)
**Responsibility:** Traffic Control & Alternative Flows (Ch. 5).
- **Security:** Checks `req.session.userId` to ensure the user is logged in.
- **Validation:** Ensures `startMs` and `endMs` exist in the query string.
- **Delegation:** Calls the Service layer and handles the `try/catch` block to prevent server crashes.

### 🟡 Layer 2: The Service (`services/availabilityService.js`)
**Responsibility:** Business Logic & Implementation Hiding (Ch. 6).
- **Access Control:** Verifies the user actually belongs to the group they are requesting.
- **Orchestration:** Coordinates between the Database Adapter and the Math Engine.
- **Consistency:** Ensures that every request is transformed into a uniform `ParticipantSnapshot` before calculation.

### 🔴 Layer 3: The Engine (`algorithm/algorithm.js`)
**Responsibility:** Pure Computation (Ch. 9: Rigorous Coverage).
- **Pure Functions:** This file has ZERO dependencies on the database or Express. It is purely mathematical.
- **Testability:** Can be tested with 100% coverage using hardcoded JSON, making it immune to database connectivity issues.

## 3. Core Principles Followed
- **Principle of Least Privilege (Ch. 3):** Routes are session-guarded and group-membership-verified.
- **Separation of Concerns (Ch. 7):** The Algorithm doesn't know about Postgres, and the Controller doesn't know about interval merging.
- **Fail-Fast Validation (Ch. 1):** We validate window sizes and member counts *before* running expensive calculations to prevent resource exhaustion.

## 4. How to Extend
If you need to change the priority logic (e.g., adding a "B4" level):
1. Update `algorithm_types.js` to include the new level.
2. Update the `priorityMapping` in `algorithmAdapter.js`.
3. The rest of the system will adapt automatically.
