import { mockEvents } from "./calendarMock.js";

// import { apiGet } from "../api/api.js";

export function renderCalendar() {
    console.log("Rendering calendar", mockEvents);

    const container = document.getElementById("calendar");
    container.innerHTML = "<h2>My Calendar</h2>";

    mockEvents.forEach(event => {
        const div = document.createElement("div");
        div.className = "calendar";

        div.innerHTML = `
            <strong>${event.title}</strong><br> 
            ${new Date(event.start).toLocaleString()} –
            ${new Date(event.end).toLocaleString()}
            `;
    
        container.appendChild(div);
    });

}