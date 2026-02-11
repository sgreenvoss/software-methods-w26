import {apiPost} from "../api/api.js";
import {apiGet} from "../api/api.js"
import {createNewGroup} from "./groupCreator.js"

// import { mockGroups } from "./groupsMock.js";

export async function renderGroups() {
  const container = document.getElementById("groups");
  container.innerHTML = `<h2>My Groups</h2>`

  const createGroupBtn = document.createElement("button");
    createGroupBtn.textContent = "+ Create New Group"
    createGroupBtn.onclick = async () => {

      createNewGroup();

      // console.log("create group button click");
      // const res = await apiPost("/group/creation?group_name=stellatestgroup", {});
      // console.log("create group result is ", res);


    }
  
  container.appendChild(createGroupBtn);

  const groups = await apiGet('/user/groups');
    
  groups.groups.forEach(group => {
    const row = document.createElement("div");
    row.className = "group-row";

    const name = document.createElement("span");
    name.textContent = group.group_name;

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.onclick = () => {
      console.log("View group", group.group_id);
    };

    const leaveBtn = document.createElement("button");
    leaveBtn.textContent = "Leave";
    leaveBtn.onclick = () => {
      console.log("leaving group", group.group_id);
      apiPost("/group/leave", {groupId : group.group_id});
    };

    row.appendChild(name);
    row.appendChild(viewBtn);
    row.appendChild(leaveBtn);

    container.appendChild(row);
  });

}
