import {apiPost} from "../../src/api.js";
import { renderGroups } from "./groupsView.js";

export function createNewGroup() {
  // 1. Create the Modal Background
  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  // 2. Create the Modal Content Box
  const content = document.createElement("div");
  content.className = "modal-content";

  // --- Title ---
  const title = document.createElement("h2");
  title.textContent = "Create New Group";
  
  // --- Group Name Input ---
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Group Name:";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Enter group name...";
  nameInput.className = "group-name-input";

  // --- User Inputs Container ---
  const usersContainer = document.createElement("div");
  usersContainer.id = "users-container";
  
  const usersLabel = document.createElement("label");
  usersLabel.textContent = "Add Users:";
  
  // Helper to add a new user row
  function addUserRow() {
    const row = document.createElement("div");
    row.className = "user-row";

    const userInput = document.createElement("input");
    userInput.type = "text";
    userInput.placeholder = "Enter username";
    userInput.className = "user-input";

    // The Plus Button (only on the last row usually, or logic to add more)
    // For simplicity, let's put a remove button on rows, 
    // and a main "Add User" button below. 
    // BUT per your request: "click a plus icon to add another row"
    
    // Let's make the "+" icon separate or part of the row
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "x";
    removeBtn.className = "remove-user-btn";
    removeBtn.onclick = () => row.remove();

    row.appendChild(userInput);
    row.appendChild(removeBtn);
    usersContainer.appendChild(row);
  }

  // Initialize with one empty slot
  addUserRow();

  // The "Plus" Icon/Button to add more slots
  const addSlotBtn = document.createElement("button");
  addSlotBtn.textContent = "+ Add another user";
  addSlotBtn.className = "add-slot-btn";
  addSlotBtn.onclick = addUserRow;

  // --- Action Buttons ---
  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => modal.remove();

  const createBtn = document.createElement("button");
  createBtn.textContent = "Create Group!";
  createBtn.className = "primary-btn";
  
  // --- The Final Logic ---
  createBtn.onclick = async () => {
    const groupName = nameInput.value.trim();
    if (!groupName) {
      alert("Please enter a group name.");
      return;
    }

    // Collect usernames (filtering out empty ones)
    const userInputs = usersContainer.querySelectorAll(".user-input");
    const usernames = Array.from(userInputs)
      .map(input => input.value.trim())
      .filter(name => name !== "");

    try {
      // 1. Create the Group and capture the result
      // We assign the response to 'creationResponse' so we can access the ID
      const creationResponse = await apiPost(`/group/creation?group_name=${encodeURIComponent(groupName)}`, {});
      
      if (creationResponse.success && creationResponse.groupId) {
        const newGroupId = creationResponse.groupId;
        console.log("Group created! ID:", newGroupId);

        // 2. Process User Invites
        // We filter out empty strings again just to be safe
        const validUsernames = usernames.filter(u => u.trim() !== "");

        if (validUsernames.length > 0) {
          // Create an array of API calls to run in parallel
          const invitePromises = validUsernames.map(username => 
             apiPost("/group/invite", {
               group_id: newGroupId,
               target_username: username
             })
          );

          // Wait for all invites to finish
          await Promise.all(invitePromises);
          console.log(`Invited ${validUsernames.length} users.`);
        }
      }

      // Close modal and re-render groups
      modal.remove();
      renderGroups(); //isn't working
    } catch (err) {
      console.error(err);
      alert("Failed to create group. Check console.");
    }
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(createBtn);

  // Assemble the Modal
  content.appendChild(title);
  content.appendChild(nameLabel);
  content.appendChild(nameInput);
  content.appendChild(usersLabel);
  content.appendChild(usersContainer);
  content.appendChild(addSlotBtn);
  content.appendChild(actions);
  modal.appendChild(content);

  // Add to DOM
  document.body.appendChild(modal);

}