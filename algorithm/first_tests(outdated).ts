// First attempt at testing before coding (01/26/26):
import {computeGroupAvailability} from './engine.js'; // Updated to remove .ts extension
import {EventInterval} from './types.js'; // TODO?

// Prepare mock data
const START_TIME = Date.UTC(2026, 0, 26, 8, 0); // Jan 26, 2026, 8:00 AM UTC
const END_TIME = Date.UTC(2026, 0, 26, 20, 0);  // Jan 26, 2026, 8:00 PM UTC
const G = 15; 

// Create Users for testing
const start_lecture_utc = Date.UTC(2026, 0, 26, 12, 0); // Jan 26, 2026, 12:00 PM UTC
const end_lecture_utc = Date.UTC(2026, 0, 26, 13, 20);   // Jan 26, 2026, 1:20 PM UTC
const start_lunch_utc = Date.UTC(2026, 0, 26, 13, 30);   // Jan 26, 2026, 1:30 PM UTC
const end_lunch_utc = Date.UTC(2026, 0, 26, 14, 0);      // Jan 26, 2026, 2:00 PM UTC
const userA_events: EventInterval[] = [
    { eventId: "lecture", start_utc: start_lecture_utc, end_utc: end_lecture_utc },
    { eventId: "lunch", start_utc: start_lunch_utc, end_utc: end_lunch_utc },
];

const start_workout_utc = Date.UTC(2026, 0, 26, 9, 0); // Jan 26, 2026, 9:00 AM UTC
const end_workout_utc = Date.UTC(2026, 0, 26, 10, 0);   // Jan 26, 2026, 10:00 AM UTC
const start_meeting_utc = Date.UTC(2026, 0, 26, 11, 0); // Jan 26, 2026, 11:00 AM UTC
const end_meeting_utc = Date.UTC(2026, 0, 26, 14, 0);   // Jan 26, 2026, 2:00 PM UTC
const userB_events: EventInterval[] = [
    { eventId: "workout", start_utc: start_workout_utc, end_utc: end_workout_utc },
    { eventId: "meeting", start_utc: start_meeting_utc, end_utc: end_meeting_utc }, 
];

// Attempt to map them
const eventsByUserId: Map<string, EventInterval[]> = new Map(); // VSCode "fixed" TODO?
eventsByUserId.set("user_A", userA_events);
eventsByUserId.set("user_B", userB_events);

// GEMINI FIX: WE ARE NOT USING RULE BASED PRIORITY I TOLD YOU i HAVE TO USE STORED PRIORITY IN DB WITH EVENT

// --- Run the engine --- 
const availability = computeGroupAvailability(eventsByUserId, START_TIME, END_TIME, G);
// GEMINI FIX: ANOTHER FIX WE AREN"T DOING QUEREIES. WE ARE DISPLAYING GROUPED UP TIME BLOCKS (potentially even letting the ui group the blocks and just returing the list of blocks)

// --- 4. Check results (mock expected results for now) ---
console.log(availability);