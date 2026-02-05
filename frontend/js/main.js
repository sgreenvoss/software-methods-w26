import { renderGroups } from "./groups/groupsView.js";
import { renderCalendar } from "./calendar/calendarController.js";

console.log("Frontend loaded");

renderCalendar();

document.getElementById("calendarBtn").onclick = showCalendar;
document.getElementById("groupsBtn").onclick = showGroups;

document.getElementById("create-group-btn").onclick = () => {
  console.log("create group button click");
}

function showCalendar() {
  console.log("Switching to calendar view");
  document.getElementById("calendar").hidden = false;
  document.getElementById("groups").hidden = true;
  renderCalendar();
}

function showGroups() {
  console.log("Switching to groups view");
  document.getElementById("calendar").hidden = true;
  document.getElementById("groups").hidden = false;
  renderGroups();
}



document.getElementById("logoutBtn").onclick = () => {
  window.location.href = "/logout";
};