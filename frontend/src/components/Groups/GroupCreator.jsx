import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPostWithMeta } from '../../api.js';
import '../../css/groupsModal.css';
import '../../css/groups.css';

function UserSearch({ onUserSelect }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/users/search?q=${query}`);
                const users = await response.json();
                setSuggestions(users);
            } catch (error) {
                console.error('Search failed:', error);
            }
            setIsLoading(false);
        }, 300); // debounce delay

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="user-search">
        <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
        />
        
        {suggestions.length > 0 && (
            <ul className="suggestions">
                {suggestions.map(user => (
                    <li className="suggestion"
                    key={user.id}
                    onClick={() => {
                        console.log("clicked", user);
                        onUserSelect(user);
                        setQuery('');
                        setSuggestions([]);
                    }}
                    >
                    {user.username}
                    </li>
                ))}
            </ul>
        )}
        
        {isLoading && <div>Searching...</div>}
        </div>
    );
}


export default function GroupCreatorModal({ onClose, onGroupCreated, onDone }) {
    const [groupName, setGroupName] = useState('');
    const [usernames, setUsernames] = useState([]);
    
    const [groupCreated, setGroupCreated] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle");
    const [createError, setCreateError] = useState("");
    const [inviteError, setInviteError] = useState("");

    useEffect(() => {
        let timeoutId;
        if (copyStatus === 'success' || copyStatus === 'error') {
            timeoutId = setTimeout(() => {
                setCopyStatus('idle');
            }, 2000);
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [copyStatus]);

    const handleUserSelect = (user) => {
        console.log('usernames:', usernames);
        // Add user if not already in the list
        if (!usernames.some(u => u.user_id === user.user_id)) {
            console.log("i am setting usernames.", user, usernames);
            setUsernames([...usernames, user]);
        }
    };

    const removeUser = (userId) => {
        setUsernames(usernames.filter(u => u.user_id !== userId));
    };

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

                try {
                    const inviteResponse = await apiPost("/group/invite", {
                        group_id: newGroupId
                    });

                    if (inviteResponse.invite) {
                        setInviteLink(inviteResponse.invite);
                        const me = await apiGet('/api/me');
                        console.log("i am ", me.user.username);
                        const username = me.user.username;
                        await apiPost("/api/group/send_link_over_email", {
                            users: usernames,
                            sender_user: username,
                            shareable_link: inviteResponse.invite
                        });
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
                {!groupCreated ? (
                    <>
                        <h2 className="modal-title">Create New Group</h2>

                        <label className="modal-label" htmlFor="group-name-input">Group Name</label>
                        <input
                            id="group-name-input"
                            type="text"
                            placeholder="Enter group name..."
                            className="group-name-input"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />

                        <label className="modal-label">Add Users</label>
                        <UserSearch onUserSelect={handleUserSelect} />
                        {usernames.length > 0 && (
                            <div id="users-container">
                                {usernames.map((user) => (
                                    <div key={user.user_id} className="user-row">
                                        <span className="user-display">{user.username}</span>
                                        <button 
                                            className="remove-user-btn" 
                                            onClick={() => removeUser(user.user_id)}
                                        >
                                            remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {createError && (
                            <p className="modal-error">{createError}</p>
                        )}

                        <div className="modal-actions">
                            <button className="secondary-btn" onClick={onClose}>Cancel</button>
                            <button className="primary-btn" onClick={handleCreate}>
                                Create Group!
                            </button>
                        </div>
                    </>
                ) : (
                    <> 
                        <h2 className="modal-title">Group Created!</h2>
                        <p className="modal-description">Share this link to invite others to <strong>{groupName}</strong>:</p>

                        <div className="invite-link-container">
                            <input
                                type="text"
                                value={inviteLink}
                                placeholder={inviteError ? "Invite link unavailable." : ""}
                                readOnly
                                className="invite-link-input"
                            />
                            <button
                                className="secondary-btn invite-copy-btn"
                                onClick={handleCopyClick}
                                disabled={!inviteLink || copyStatus === 'copying'}
                            >
                                {copyStatus === 'success' ? 'Copied!' : 
                                copyStatus === 'error' ? 'Error' : 'Copy'}
                            </button>
                        </div>

                        {inviteError && (
                            <p className="modal-error">{inviteError}</p>
                        )}

                        {copyStatus === 'error' && (
                            <p className="modal-error">
                                Failed to copy invite link. Please try copying manually.
                            </p>
                        )}

                        <div className="modal-actions">
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