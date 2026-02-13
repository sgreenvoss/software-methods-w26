import {apiPost} from "../../src/api.js";
import {apiGet} from "../../src/api.js"
import {createNewGroup} from "./groupCreator.js"

// import { mockGroups } from "./groupsMock.js";

export async function renderGroups() {
  const container = document.getElementById("groups");
  container.innerHTML = `<h2>My Groups</h2>`

  const createGroupBtn = document.createElement("button");
    createGroupBtn.textContent = "+ Create New Group"
    createGroupBtn.onclick = async () => {

      await createNewGroup();
    }
  
  container.appendChild(createGroupBtn);

  const groups = await apiGet('/user/groups');
    
  groups.groups.forEach(group => {
    const row = document.createElement("div");
    row.className = "group-row";

    const name = document.createElement("span");
    name.textContent = group.group_name;

    const viewBtn = document.createElement("button");
    viewBtn.id = "viewBtn"
    viewBtn.textContent = "View";
    viewBtn.onclick = () => {
      console.log("View group", group.group_id);
    };

    const leaveBtn = document.createElement("button");
    leaveBtn.id = "leaveBtn"
    leaveBtn.textContent = "Leave";
    leaveBtn.onclick = async () => {
      console.log("leaving group", group.group_id);
      await apiPost("/group/leave", {groupId : group.group_id});
      renderGroups();
    };

    const btnGroup = document.createElement("div");
    btnGroup.appendChild(viewBtn);
    btnGroup.appendChild(leaveBtn);

    row.appendChild(name);
    row.appendChild(btnGroup);

    container.appendChild(row);
  });

}
