import { mockEvents } from "./calendarMock.js";

export function renderCalendarGrid(container, weekStart) {
//   container.innerHTML = "";

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

  for (let hour = 8; hour <= 20; hour++) {
    const timeLabel = document.createElement("div");
    timeLabel.className = "time-label";
    timeLabel.textContent = `${hour}:00`;
    grid.appendChild(timeLabel);

    days.forEach(day => {
      const cell = document.createElement("div");
      cell.className = "calendar-cell";
      cell.dataset.day = day.toDateString();
      cell.dataset.hour = hour;

      mockEvents.forEach(event => {
        const start = new Date(event.start);
        if (
          start.toDateString() === day.toDateString() &&
          start.getHours() === hour
        ) {
          const eventDiv = document.createElement("div");
          eventDiv.className = "calendar-event";
          eventDiv.textContent = event.title;
          cell.appendChild(eventDiv);
        }
      });

      grid.appendChild(cell);
    });
  }

  container.appendChild(grid);
}
