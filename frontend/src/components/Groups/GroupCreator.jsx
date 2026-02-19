import React, { useState } from 'react';
import { apiPost } from '../../api.js'; // Adjust path if needed based on your folder structure
import '../../css/groupsModal.css';
import '../../css/groups.css';


export default function GroupCreatorModal({ onClose, onGroupCreated }) {
    const [groupName, setGroupName] = useState('');
    // Initialize with one empty string to mimic "addUserRow()" running once at start
    const [usernames, setUsernames] = useState(['']); 

    // Handle changing a specific username input
    const handleUserChange = (index, value) => {
        const newUsernames = [...usernames];
        newUsernames[index] = value;
        setUsernames(newUsernames);
    };

    // Add a new empty slot
    const addUserSlot = () => {
        setUsernames([...usernames, '']);
    };

    // Remove a slot
    const removeUserSlot = (index) => {
        const newUsernames = usernames.filter((_, i) => i !== index);
        setUsernames(newUsernames);
    };

    const handleCreate = async () => {
        if (!groupName.trim()) {
            alert("Please enter a group name.");
            return;
        }

        const validUsernames = usernames
            .map(u => u.trim())
            .filter(u => u !== "");

        try {
            // 1. Create the Group
            // Using encodeURIComponent just like the legacy code
            const creationResponse = await apiPost(`/group/creation?group_name=${encodeURIComponent(groupName)}`, {});

            if (creationResponse.success && creationResponse.groupId) {
                const newGroupId = creationResponse.groupId;
                console.log("Group created! ID:", newGroupId);

                // 2. Process User Invites
                if (validUsernames.length > 0) {
                    const invitePromises = validUsernames.map(username =>
                        apiPost("/group/invite", {
                            group_id: newGroupId,
                            target_username: username
                        })
                    );
                    await Promise.all(invitePromises);
                    console.log(`Invited ${validUsernames.length} users.`);
                }

                // Success! Close modal and refresh parent
                onGroupCreated();
            }
        } catch (err) {
            console.error(err);
            alert("Failed to create group. Check console.");
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Create New Group</h2>

                <label>Group Name:</label>
                <input
                    type="text"
                    placeholder="Enter group name..."
                    className="group-name-input"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                />

                <label>Add Users:</label>
                <div id="users-container">
                    {usernames.map((user, index) => (
                        <div key={index} className="user-row">
                            <input
                                type="text"
                                placeholder="Enter username"
                                className="user-input"
                                value={user}
                                onChange={(e) => handleUserChange(index, e.target.value)}
                            />
                            <button 
                                className="remove-user-btn" 
                                onClick={() => removeUserSlot(index)}
                            >
                                remove
                            </button>
                        </div>
                    ))}
                </div>

                <button className="add-slot-btn" onClick={addUserSlot}>
                    + Add another user
                </button>

                <div className="modal-actions">
                    <button onClick={onClose}>Cancel</button>
                    <button className="primary-btn" onClick={handleCreate}>
                        Create Group!
                    </button>
                </div>
            </div>
        </div>
    );
}