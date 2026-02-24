import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api'; // Adjust path based on your folder structure
import '../../css/calendar.css';

// --- HELPER LOGIC (The "Business Logic" or Model Helpers) ---
function getStartOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CustomCalendar({ groupId, draftEvent }) {
  // --- STATE (The "Controller" Data) ---
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ACTIONS (The "Controller" Logic) ---
  console.log("3. CustomCalendar received groupId prop:", groupId);
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        if (groupId) {
          // 1. Fetch group availability for the currently viewed week
          const startMs = weekStart.getTime();
          const ONEWEEK_MS = 7 * 24 * 60 * 60 * 1000;
          const endMs = startMs + ONEWEEK_MS; // 7 days later

          const response = await apiGet(`/api/groups/${groupId}/availability?windowStartMs=${startMs}&windowEndMs=${endMs}&granularityMinutes=15`); // URL HARDCODED FOR G=15 FIXME 02-20 3.0
          
          // PROOF OF CONCEPT Console.log, idk why it isn't displaying) 02-20 2.1
          console.log("RAW AVAILABILITY DATA:", response); // Testing why blank availability view: fix 02-20 2.2
          if (response && response.ok && response.availability) {
            // 2. Disguise the availability blocks as standard events for your UI
            const heatmapEvents = response.availability.map((block, i) => ({
              title: `Avail: ${block.count}`,
              start: block.start,
              end: block.end,
              event_id: `avail-${i}`
            }));
            setRawEvents(heatmapEvents);
          } else {
            setRawEvents([]);
          }
        } else {
          // Default: Fetch personal events
          const personalEvents = await apiGet('/api/events');
          if (Array.isArray(personalEvents)) {
            setRawEvents(personalEvents);
          }
          else if (personalEvents && personalEvents.error) {
            console.warn("Backend rejected token:", personalEvents.error);
            setRawEvents([]);
            window.location.href = '/login'; // IDK
          }
          else {
            console.warn("Unexpected data format for personal events recieved from api/events", personalEvents);
            setRawEvents([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch calendar events:', error);
        setRawEvents([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, [groupId, weekStart]); // Adding weekStart ensures it refetches if you click Prev/Next week

  const handlePrevWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStart(newDate);
  };

  // --- PREPARING THE VIEW ---
  const events = processEvents(rawEvents);

  if (draftEvent) {
      events.push({
          ...draftEvent,
          isAllDay: false, // assuming typed events aren't all day for now
          isEndOfDay: false
      });
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div id="calendar-container">
      {/* 1. CALENDAR HEADER (Navigation) */}
      <div className="calendar-header">
        <button onClick={handlePrevWeek}>← Prev</button>
        <h2>
          {weekStart.toLocaleString("default", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={handleNextWeek}>Next →</button>
      </div>

      {/* 2. CALENDAR GRID (View) */}
      <div className="calendar-grid">
        <div className="corner-cell"></div>
        {days.map((day, i) => (
          <div key={i} className="day-header">
            {day.toLocaleDateString("default", { weekday: "short", month: "numeric", day: "numeric" })}
          </div>
        ))}

        {hours.map(hour => (
          <React.Fragment key={hour}>
            <div className="time-label">
              {`${hour === 0 || hour === 12 ? 12 : hour % 12}:00${hour < 12 ? 'am' : 'pm'}`}
            </div>

            {days.map((day, i) => (
              <div key={i} className="calendar-cell">
                {events
                  .filter(e => e.start.toDateString() === day.toDateString() && e.start.getHours() === hour)
                  .map((event, idx) => {
                    const startMins = event.start.getMinutes();
                    const duration = (event.end - event.start) / (1000 * 60);

                    // precise visual logic
                    // each grid line (hour) subtracts 2px to height, so add duration/30
                    let visualHeight = (duration / 30) + duration - 10; // -10 to add padding between events 
                    const endsOnHour = event.end.getMinutes() === 0 && event.end.getSeconds() === 0;
                    if (!event.isEndOfDay && !endsOnHour) visualHeight -= 2;

                    let backgroundColor = 'cornflowerblue';
                    if (event.mode === 'blocking') backgroundColor = 'darkslategray';
                    if (event.mode === 'petition') backgroundColor = 'peru';
                    
                    return (
                      <div
                        key={idx}
                        className={`calendar-event ${event.isAllDay ? 'all-day-event' : ''}`}
                        style={{
                          height: `${Math.max(1, visualHeight)}px`,
                          top: `${startMins}px`,
                          opacity: event.isAllDay || event.isPreview? 0.6 : 1,

                          backgroundColor: backgroundColor,
                          border: event.isPreview ? '2px dashed #333' : 'none'
                          
                        }}
                      >
                        {event.title}
                      </div>
                    );
                  })}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      {loading && <p>Loading events...</p>}
    </div>
  );
}

// --- KEEP YOUR PROCESSING FUNCTIONS OUTSIDE THE COMPONENT ---
// This keeps the "Business Logic" separate from the "View"
function processEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
  console.log("in the processing events function");
  const processed = [];
  rawEvents.forEach(event => {
    let start = parseLocal(event.start);
    let end = parseLocal(event.end);
    if (end <= start) return;

    let current = new Date(start);
    while (current < end) {
      const nextDayStart = new Date(current);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      nextDayStart.setHours(0, 0, 0, 0);
      let effectiveEnd = (end < nextDayStart) ? end : nextDayStart;

      processed.push({
        title: event.title,
        start: new Date(current),
        end: new Date(effectiveEnd),
        id: event.event_id,
        isAllDay: (effectiveEnd - current) >= 24 * 60 * 60 * 1000,
        isEndOfDay: effectiveEnd.getTime() === nextDayStart.getTime()
      });
      current = nextDayStart;
    }
  });
  return processed;
}

function parseLocal(dateInput) {
  if (typeof dateInput === 'string' && dateInput.length === 10) {
    const [y, m, d] = dateInput.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateInput);
}