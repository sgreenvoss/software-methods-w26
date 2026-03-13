/*
File: GroupCreator.jsx
Purpose: This component handles the group creation module,
    including searching for existing users and creating a 
    shareable link.
Creation date: 2026-02-16
Initial Author(s): Anna Norris

System Context:
Part of the frontend system. Newly created groups are shown in 
the groups sidebar.
*/

import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPostWithMeta } from '../../api.js';
import '../../css/groupsModal.css';
import '../../css/groups.css';

/**
 * Searchbar for existing users for user to invite to new group
 * 
 * @param {Function} onUserSelect -- for dropdown menu choosing users
 * @returns {@JSX.Element} -- an input field with a dropdown menu attached
 *      that displays any existing users based on current input, users can click
 *      to select that user
 */
function UserSearch({ onUserSelect }) {
    // for displaying suggestions on user input
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // based on query, find any users with matching substring
    useEffect(() => {
        // only check when length is more than 2 characters
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }

        // set the suggestions from endpoint search
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
                placeholder="Search users by name..."
            />
            
            {/* The new floating dropdown menu */}
            {suggestions.length > 0 && (
                <ul className="search-dropdown-menu">
                    {suggestions.map(user => (
                        <li 
                            className="search-dropdown-item"
                            key={user.id}
                            onClick={() => {
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
            
            {isLoading && <div className="search-loading-text">Searching...</div>}
        </div>
    );
}

/**
 * Modal for creating a new group and generating a shareable invite link.
 * Allows users to enter a group name, search for and add existing users,
 * then generates an invite link and sends it via email to selected users.
 * 
 * @param {Function} onClose - callback to close modal
 * @param {*} onGroupCreated - for successful group creation
 * @param {*} onDone - done upon group creation
 * @returns {@JSX.Element} - modal overlay with group creation from form
 *      or invite-link confirmation screen
 */
export default function GroupCreatorModal({ onClose, onGroupCreated, onDone }) {
    // names
    const [groupName, setGroupName] = useState('');
    const [usernames, setUsernames] = useState([]);
    
    // new group management
    const [groupCreated, setGroupCreated] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [copyStatus, setCopyStatus] = useState("idle");
    const [createError, setCreateError] = useState("");
    const [inviteError, setInviteError] = useState("");

    // only try to create a group for a certain amount of time
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

    // handle the usernames user selects
    const handleUserSelect = (user) => {
        // Add user if not already in the list
        if (!usernames.some(u => u.user_id === user.user_id)) {
            setUsernames([...usernames, user]);
        }
    };

    // handle user choosing to remove user from list
    const removeUser = (userId) => {
        setUsernames(usernames.filter(u => u.user_id !== userId));
    };

    // handle user copying shareable link using button
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

    // handle creating the group
    const handleCreate = async () => {
        setCreateError("");
        setInviteError("");
        setCopyStatus("idle");

        // group must have name
        if (!groupName.trim()) {
            setCreateError("Please enter a group name.");
            return;
        }

        try {
            // send signal to create group to backend
            const creationMeta = await apiPostWithMeta(`/group/creation?group_name=${encodeURIComponent(groupName)}`, {});
            const creationResponse = creationMeta.data;

            // on successful group creation, change frontend display
            if (creationMeta.status === 201 && creationResponse?.success && creationResponse?.groupId) {
                const newGroupId = creationResponse.groupId;
                setGroupCreated(true);
                setInviteLink("");
                setCreateError("");
                setInviteError("");
                if (typeof onGroupCreated === "function") {
                    onGroupCreated();
                }

                // send emails to selected users
                try {
                    // send signal to invite users
                    const inviteResponse = await apiPost("/group/invite", {
                        group_id: newGroupId
                    });

                    // set invite link and send over email
                    if (inviteResponse.invite) {
                        setInviteLink(inviteResponse.invite);
                        const me = await apiGet('/api/me');
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