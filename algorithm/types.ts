// First attempt at interfaces/maps/and understnading JS object flow (01/26/26):
export interface EventInterval {
    eventId: string;
    start_utc: number;
    end_utc: number;
}

// Attempt to use a map
const eventsByUserId: Map<string, EventInterval[]> = new Map();


// Basic (not a test) object use
/*
const start_lecture_utc = Date.UTC(2026, 0, 26, 12, 0); // Jan 26, 2026, 12:00 PM UTC
const end_lecture_utc = Date.UTC(2026, 0, 26, 13, 20);   // Jan 26, 2026, 1:20 PM UTC
const start_lunch_utc = Date.UTC(2026, 0, 26, 13, 30);   // Jan 26, 2026, 1:30 PM UTC
const end_lunch_utc = Date.UTC(2026, 0, 26, 14, 0);      // Jan 26, 2026, 2:00 PM UTC
const davidsEvents: EventInterval[] = [
    { eventId: "lecture", start_utc: start_lecture_utc, end_utc: end_lecture_utc },
    { eventId: "lunch", start_utc: start_lunch_utc, end_utc: end_lunch_utc },
];



// Another user for example
eventsByUserId.set("user_002", [ 
    {eventId: "work", start_utc: Date.UTC(2026,0,26,9,0), end_utc: Date.UTC(2026,0,26,17,0)} // Overaps with davidsEvents
]);
*/
