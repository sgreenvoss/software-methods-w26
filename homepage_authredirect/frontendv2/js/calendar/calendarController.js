import { renderCalendarGrid } from "./calendarRender.js";
import { renderAvailability } from "./availabilityRender.js";

let currentWeekStart = getStartOfWeek(new Date());

function getStartOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function renderCalendar() {
  const container = document.getElementById("calendar");
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "calendar-header";

  const prev = document.createElement("button");
  prev.textContent = "← Prev";
  prev.onclick = () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderCalendar();
  };

  const next = document.createElement("button");
  next.textContent = "Next →";
  next.onclick = () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderCalendar();
  };

  const title = document.createElement("h2");
  title.textContent = currentWeekStart.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  header.append(prev, title, next);
  container.appendChild(header);

  console.log("Before renderCalendarGrid:", container.innerHTML);
  renderCalendarGrid(container, currentWeekStart);

  console.log("Before renderAvailability", container.innerHTML);
  renderAvailability();
}
