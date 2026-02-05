export async function renderCalendarGrid(container, weekStart, events) {
  // container.innerHTML = "";

  // Configuration
  const START_HOUR = 0;
  const END_HOUR = 23; // 9 PM
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

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
      timeLabel.textContent = `${hour}:00`;
      grid.appendChild(timeLabel);

    days.forEach(day => {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      cell.dataset.day = day.toDateString();
      cell.dataset.hour = hour;

      events.forEach(event => {
        const start = new Date(event.start);
        const startMins = start.getMinutes();
        const end = new Date(event.end);
        const duration = (end - start) / (1000 * 60)

        if (
          start.toDateString() === day.toDateString() &&
          start.getHours() === hour
        ) {
            const eventDiv = document.createElement("div");
            eventDiv.className = "calendar-event";
            eventDiv.textContent = event.title;

            // set event height and starting position
            eventDiv.style.height = `${duration}px`;
            eventDiv.style.top = `${startMins}px`;

            cell.appendChild(eventDiv);
        }
        });

      grid.appendChild(cell);
    });
}


  container.appendChild(grid);
}
