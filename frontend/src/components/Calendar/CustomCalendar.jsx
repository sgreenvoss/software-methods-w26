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

export default function CustomCalendar() {
  // --- STATE (The "Controller" Data) ---
  const [weekStart, setWeekStart] = useState(getStartOfWeek(new Date()));
  const [rawEvents, setRawEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ACTIONS (The "Controller" Logic) ---
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const data = await apiGet('/api/events');
        setRawEvents(data);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

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

                    // Your precise visual logic
                    let visualHeight = (duration / 30) + duration - 10;
                    const endsOnHour = event.end.getMinutes() === 0 && event.end.getSeconds() === 0;
                    if (!event.isEndOfDay && !endsOnHour) visualHeight -= 2;

                    return (
                      <div
                        key={idx}
                        className={`calendar-event ${event.isAllDay ? 'all-day-event' : ''}`}
                        style={{
                          height: `${Math.max(1, visualHeight)}px`,
                          top: `${startMins}px`,
                          opacity: event.isAllDay ? 0.6 : 1
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