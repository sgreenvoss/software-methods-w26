import React, { useState, useEffect } from 'react';
import React, { useState, useEffect } from 'react';
import { apiPost } from '../../api.js'; // Adjust path if needed based on your folder structure
import '../../css/groupsModal.css';
import '../../css/groups.css';


export default function GroupCreatorModal({ onClose, onGroupCreated }) {
    const [groupName, setGroupName] = useState('');
    // Initialize with one empty string to mimic "addUserRow()" running once at start
    const [usernames, setUsernames] = useState(['']); 

    // =============================================================================
    // GrInv: 1.0 Implementing Structural framework for groupInvite, (think this is the right startingpoint)
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle"); // "idle", "success", "error"

    useEffect(() => {
        let timeoutId;
        if (copyStatus === 'success' || copyStatus === 'error') {
            timeoutId = setTimeout(() => {
                setCopyStatus('idle');
            }, 2000); // Reset status after 2 seconds -- also allows for cutoff if close modal
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [copyStatus]);

    // async ClipBoard Function
    const handleCopyClick = async () => {
        setCopyStatus("copying");
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopyStatus("success");
        } catch (err) {
            console.error("Failed to copy!", err);
            setCopyStatus("error");
        }
    };
    // =============================================================================
    // Handle changing a specific username input
    const handleUserChange = (index, value) => {
        const newUsernames = [...usernames];
        newUsernames[index] = value;
        setUsernames(newUsernames);
    };

    // Add a new empty slot
    const addUserSlot = () => { setUsernames([...usernames, '']); };

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

                // ---- GrInv: 1.1 Matching backend structure before changing it ----
                try {
                    const inviteResponse = await apiPost("/group/invite", {
                        group_id: newGroupId
                    });

                    if (inviteResponse.invite) {
                        // Update the state with the real url
                        setInviteLink(inviteResponse.invite);
                    }
                } catch(inviteErr) {
                    console.error("Failed to fetch invite link:", inviteErr);
                    // still set it
                    setInviteLink("Error generating link. Please try again.");
                }
                // Still no call to onGroupCreated() here,
                // so that modal stays OPEN for them to COPY LINK
            }
        } catch (err) {
        console.error(err);
        alert("Failed to create group. Check console.");
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* ----- GrInv: 1.0 Conditional Rendering for Invite Link Generation ----- */}

                {!inviteLink ? (
                    <>
                        {/* ---- ORIGINAL VIEW: Group Creation Form (Unchanged) ----- */}      
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
                    <button className="add-slot-btn" onClick={addUserSlot}>
                        + Add another user
                    </button>

                    <div className="modal-actions">
                        <button onClick={onClose}>Cancel</button>
                        <button className="primary-btn" onClick={handleCreate}>
                            Create Group!
                        </button>
                    </div>
                </>
            ) : (
                <> 
                    {/* ----- GrInv: 1.0 Adding Necessary Return for Invite Link Generation ----- */}
                    <h2>Group Created!</h2>
                    <p>Share this link to invite others to <strong>{groupName}</strong>:</p>

                    <div className="invite-link-container" style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
                        <input
                            type="text"
                            value={inviteLink}
                            readOnly
                            style={{ flex: 1, padding: '8px' }}
                        />
                        <button
                            onClick={handleCopyClick}
                            disabled={copyStatus === 'copying'}
                        >
                            {copyStatus === 'success' ? 'Copied!' : 
                            copyStatus === 'error' ? 'Error' : 'Copy'}
                        </button>
                    </div>

                    {copyStatus === 'error' && (
                        <p style={{ color: 'red', fontSize: '0.85rem' }}>
                            Failed to copy invite link. Please try copying manually.
                        </p>
                    )}

                    <div className="modal-actions">
                        {/* Closing the modal and triggering a parent refresh */}
                        <button className="primary-btn" onClick={() => onGroupCreated()}>
                            Done
                        </button>
                    </div>
                </>
            )}
        </div>
    </div>
    );
}