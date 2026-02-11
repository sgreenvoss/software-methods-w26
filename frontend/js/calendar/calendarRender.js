export async function renderCalendarGrid(container, weekStart, rawEvents) {
  // container.innerHTML = "";

  // Configuration
  const START_HOUR = 0;
  const END_HOUR = 23; // 9 PM
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

  const events = processEvents(rawEvents);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  grid.appendChild(document.createElement("div"));

  days.forEach(day => {
    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = day.toLocaleDateString("default", {
      weekday: "short",
      month: "numeric",
      day: "numeric"
    });
    grid.appendChild(header);
  });


  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      const timeLabel = document.createElement("div");
      timeLabel.className = "time-label";
      timeLabel.textContent = `${hour==0 || hour==12 ? 12 : (hour%12)}:00${hour<12 ? 'am' : 'pm'}`;
      grid.appendChild(timeLabel);

    days.forEach(day => {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      cell.dataset.day = day.toDateString();
      cell.dataset.hour = hour;

      events.forEach(event => {
        // const start = new Date(event.start);
        // 
        // const end = new Date(event.end);
        // 
        const start = event.start;
        const end = event.end;


        if (
          start.toDateString() === day.toDateString() &&
          start.getHours() === hour
        ) {
            const startMins = start.getMinutes();
            const endMins = end.getMinutes();
            const endSecs = end.getSeconds();
            const duration = (end - start) / (1000 * 60)

            const eventDiv = document.createElement("div");
            eventDiv.className = "calendar-event";
            eventDiv.textContent = event.title;

            // each grid line (hour) subtracts 2px to height, so add duration/30
            let visualHeight = (duration/30) + duration-10;
            const endsOnHour = endMins === 0 && endSecs === 0;
            // set event height and starting position
            if (!event.isEndOfDay && !endsOnHour) {
              visualHeight = visualHeight-2;
            }
            visualHeight = Math.max(1, visualHeight);
            eventDiv.style.height = `${visualHeight}px`;
            eventDiv.style.top = `${startMins}px`;
            if (event.isAllDay) eventDiv.style.opacity = "60%";

            if (event.isAllDay) eventDiv.classList.add("all-day-event")
            cell.appendChild(eventDiv);
        }
        });

      grid.appendChild(cell);
    });
}


  container.appendChild(grid);
}

function processEvents(rawEvents) {
  const processed = [];

  rawEvents.forEach(event => {
    let start = parseLocal(event.start);
    let end = parseLocal(event.end);

    if (end<=start) return;

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
  // "YYYY-MM-DD" is 10 characters
  if (typeof dateInput === 'string' && dateInput.length === 10) {
    const [y, m, d] = dateInput.split('-').map(Number);
    
    return new Date(y, m-1, d);
  }
  return new Date(dateInput);
}