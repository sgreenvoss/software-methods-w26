import { renderGroups } from "./groups/groupsView.js";
import { renderCalendar } from "./calendar/calendarController.js";
import { getCurrentUser } from "./auth.js";

// putting this in here just for groups - could build
// a specific group frontend file to prevent bloat
import {apiPost} from "./api/api.js";

console.log("Frontend loaded");

async function initApp() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "/login.html";
  }

  console.log("welcome!");
  renderCalendar();
}

initApp();

document.getElementById("calendarBtn").onclick = showCalendar;
document.getElementById("groupsBtn").onclick = showGroups;

document.getElementById("create-group-btn").onclick = () => {
  console.log("create group button click");
  const res = apiPost("/group/creation?group_name=stellatestgroup", 0);
  console.log("create group result is ", res);
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
  // window.location.href = "https://scheduler-backend-9b29.onrender.com/logout";
};