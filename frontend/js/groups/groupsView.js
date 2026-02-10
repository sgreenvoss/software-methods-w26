import {apiPost} from "../api/api.js";
import {apiGet} from "../api/api.js"
// import { mockGroups } from "./groupsMock.js";

export async function renderGroups() {
  const container = document.getElementById("groups");
  container.innerHTML = `<h2>My Groups</h2>`

  const createGroup = document.createElement("button");
    createGroup.textContent = "+ Create New Group"
    createGroup.onclick = async () => {
      console.log("create group button click");
      const res = await apiPost("/group/creation?group_name=stellatestgroup", {});
      console.log("create group result is ", res);
    }
  
  container.appendChild(createGroup);

  const groups = await apiGet('/user/groups');
    
  groups.groups.forEach(group => {
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
