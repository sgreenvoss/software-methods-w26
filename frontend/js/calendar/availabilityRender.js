import { mockAvailability } from "./availabilityMock.js";

export function renderAvailability() {
  const cells = document.querySelectorAll(".calendar-cell");

  cells.forEach(cell => {
    const day = cell.dataset.day;
    const hour = Number(cell.dataset.hour);

    mockAvailability.forEach(slot => {
      const start = new Date(slot.start);
      const end = new Date(slot.end);

      if (
        start.toDateString() === day &&
        hour >= start.getHours() &&
        hour < end.getHours()
      ) {
        const overlay = document.createElement("div");
        overlay.className = "availability-block";
        cell.appendChild(overlay);
      }
    });
  });
}
