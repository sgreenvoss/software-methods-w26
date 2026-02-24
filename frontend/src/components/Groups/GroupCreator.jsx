import React, { useState, useEffect } from 'react';
import { apiPost, apiPostWithMeta } from '../../api.js';
import '../../css/groupsModal.css';
import '../../css/groups.css';


export default function GroupCreatorModal({ onClose, onGroupCreated, onDone }) {
    const [groupName, setGroupName] = useState('');
    // Initialize with one empty string to mimic "addUserRow()" running once at start
    const [usernames, setUsernames] = useState(['']); 

    // =============================================================================
    // GrInv: 1.0 Implementing Structural framework for groupInvite, (think this is the right startingpoint)
    const [groupCreated, setGroupCreated] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle"); // "idle", "success", "error"
    const [createError, setCreateError] = useState("");
    const [inviteError, setInviteError] = useState("");

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
        if (!inviteLink) {
            setCopyStatus("error");
            return;
        }

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
        setCreateError("");
        setInviteError("");
        setCopyStatus("idle");

        if (!groupName.trim()) {
            setCreateError("Please enter a group name.");
            return;
        }

        try {
            const creationMeta = await apiPostWithMeta(`/group/creation?group_name=${encodeURIComponent(groupName)}`, {});
            const creationResponse = creationMeta.data;

            if (creationMeta.status === 201 && creationResponse?.success && creationResponse?.groupId) {
                const newGroupId = creationResponse.groupId;
                console.log("Group created! ID:", newGroupId);
                setGroupCreated(true);
                setInviteLink("");
                setCreateError("");
                setInviteError("");
                if (typeof onGroupCreated === "function") {
                    onGroupCreated();
                }

                // ---- GrInv: 1.1 Matching backend structure before changing it ----
                try {
                    const inviteResponse = await apiPost("/group/invite", {
                        group_id: newGroupId
                    });

                    if (inviteResponse.invite) {
                        // Update the state with the real url
                        setInviteLink(inviteResponse.invite);
                        setInviteError("");
                    } else {
                        setInviteError("Group created, but invite link was not returned.");
                    }
                } catch(inviteErr) {
                    console.error("Failed to fetch invite link:", inviteErr);
                    setInviteError("Group created, but invite link generation failed.");
                }
            } else {
                setGroupCreated(false);
                setInviteLink("");
                setCreateError(creationResponse?.error || "Failed to create group.");
            }
        } catch (err) {
            console.error(err);
            setGroupCreated(false);
            setInviteLink("");
            setCreateError("Failed to create group. Check console.");
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* ----- GrInv: 1.0 Conditional Rendering for Invite Link Generation ----- */}

                {!groupCreated ? (
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

                    {createError && (
                        <p style={{ color: 'red', fontSize: '0.85rem', marginTop: '12px' }}>
                            {createError}
                        </p>
                    )}

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
                            placeholder={inviteError ? "Invite link unavailable." : ""}
                            readOnly
                            style={{ flex: 1, padding: '8px' }}
                        />
                        <button
                            onClick={handleCopyClick}
                            disabled={!inviteLink || copyStatus === 'copying'}
                        >
                            {copyStatus === 'success' ? 'Copied!' : 
                            copyStatus === 'error' ? 'Error' : 'Copy'}
                        </button>
                    </div>

                    {inviteError && (
                        <p style={{ color: 'red', fontSize: '0.85rem' }}>
                            {inviteError}
                        </p>
                    )}

                    {copyStatus === 'error' && (
                        <p style={{ color: 'red', fontSize: '0.85rem' }}>
                            Failed to copy invite link. Please try copying manually.
                        </p>
                    )}

                    <div className="modal-actions">
                        {/* Closing the modal only. Group list refresh already happened on 201 success. */}
                        <button className="primary-btn" onClick={() => (onDone ? onDone() : onClose())}>
                            Done
                        </button>
                    </div>
                </>
            )}
        </div>
    </div>
    );
}
