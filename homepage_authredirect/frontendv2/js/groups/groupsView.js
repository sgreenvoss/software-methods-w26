// replace mockGroups with await apiGet("/groups")

import { mockGroups } from "./groupsMock.js";

export function renderGroups() {

  console.log("Rendering groups:", mockGroups);

  const container = document.getElementById("groups");
  container.innerHTML = `
    <h2>My Groups</h2>
    <button id="create-group-btn">+ Create New Group</button>`

  mockGroups.forEach(group => {
    const row = document.createElement("div");
    row.className = "group-row";

    const name = document.createElement("span");
    name.textContent = group.groupName;

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.onclick = () => {
      console.log("View group", group.groupId);
    };

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave";
    leaveBtn.onclick = () => {
      console.log("Leave group", group.groupId);
    };

    row.appendChild(name);
    row.appendChild(viewBtn);
    row.appendChild(leaveBtn);

    container.appendChild(row);
  });

}
