/*
File: Groups.jsx
Purpose: Main groups management section displaying user's groups 
        with actions for viewing, creating, petitioning, and leaving
Date Created: 2026-02-13
Initial Author(s): Anna Norris

System Context:
Renders a list of groups the user belongs to, with controls 
to create new groups, view group details, open the petition workflow for a specific group, 
and leave groups. Integrates with the groups API for fetching, creating, and leaving groups. 
Internally manages modals for group creation and info display.
*/

// React imports - useState for modal and group state, useEffect for fetching on refresh, useContext for error handling
import React, { useState, useEffect, useContext } from 'react';

// API utilities - apiGet for fetching user groups, apiPost for leaving groups
import { apiGet, apiPost } from '../../api.js';

// Modal components - GroupCreatorModal for creating new groups, GroupInfoModal for displaying group details
import GroupCreatorModal from './GroupCreator.jsx';
import GroupInfoModal from './GroupInfo.jsx';

// Error context - provides setError function for communicating errors to the global error handler
import { ErrorContext } from '../../ErrorContext.jsx';

// CSS stylesheets - groups.css for section and list styling, groupsModal.css for modal overlay
import '../../css/groups.css';
import '../../css/groupsModal.css';

/**
 * Displays the user's groups with controls for creating, viewing, petitioning, and leaving groups.
 * Manages group list state, modal visibility, and parent-driven group selection updates.
 *
 * @param {Object} props - Component props
 * @param {number|string|null} props.selectedGroupId - Currently selected group ID for active highlighting
 * @param {function} props.onSelectGroup - Callback to notify parent of group selection changes
 * @param {function} props.onOpenPetition - Callback to open the petition workflow for a specific group
 * @param {number} [props.refreshSignal=0] - Refresh dependency value from parent used to refetch groups
 * @returns {JSX.Element} Section containing the group list, action buttons, and conditional modals
 */
export default function Groups({ selectedGroupId, onSelectGroup, onOpenPetition, refreshSignal = 0 }) {
    const [groups, setGroups] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [infoModalGroup, setInfoModalGroup] = useState(null);

    // Global error context for displaying API errors to user
    const { setError } = useContext(ErrorContext);

    // Fetch user's groups from backend and update local state; handles errors gracefully
    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await apiGet('/user/groups');
            if (response && response.groups) {
                setGroups(response.groups);
            } else {
                setGroups([]);
            }
        } catch (error) {
            console.error("Failed to fetch groups", error);
            setGroups([]);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch groups on component mount and whenever parent sends a refresh signal (refreshSignal dependency)
    useEffect(() => {
        fetchGroups();
    }, [refreshSignal]);

    // Remove user from specified group; deselect if it was the active group and refresh the list
    const handleLeaveGroup = async (groupId) => {
        console.log("leaving group", groupId);
        try {
            await apiPost('/group/leave', { groupId: groupId });
            // Refresh list after leaving
            fetchGroups();
            if (Number(selectedGroupId) === Number(groupId)) {
                onSelectGroup(null);
                // Deselect group if it was the active one
            }
        } catch (error) {
            console.error("Failed to leave group", error);
            setError(error.message);
        }
    };

    // Refetch groups after successful creation; modal remains open to allow user to share invite link
    const handleCreateSuccess = () => {
        // Refresh immediately after create success; modal remains open for invite sharing.
        fetchGroups();
    };

    // Close the group creation modal
    const handleModalDone = () => {
        setShowModal(false);
    };

    return (
        // ID "groups" is crucial for matching css/groups.css selectors
        <section id="groups">
            <h2>My Groups</h2>

            <button onClick={() => setShowModal(true)}>
                + Create New Group
            </button>

            {loading ? <p>Loading...</p> : null}

            {groups.map((group) => {
                const isActive = Number(selectedGroupId) === Number(group.group_id);
                return (
                <div key={group.group_id} className="group-row">
                    <span>{group.group_name}</span>
                    
                    <div>
                        <button 
                            id="infoBtn" 
                            onClick={() => {
                                setInfoModalGroup(group);
                            }}
                        >
                            Info
                        </button>

                        <button 
                            id="viewBtn" 
                            className={isActive ? 'active-view-btn' : ''}
                            style={{background: isActive ? '#26aa5d' : '#2ecc71'}}
                            onClick={() => {
                                if (isActive) {
                                    onSelectGroup(null);
                                } else {
                                    onSelectGroup(group.group_id);
                                }
                            }}
                        >
                            {isActive ? 'Hide' : 'View'}
                        </button>

                        <button 
                            id="petitionBtn" 
                            onClick={() => {
                                console.log("Create petition for group", group.group_id);
                                onOpenPetition(group.group_id);
                            }}
                        >
                            Petition
                        </button>

                        <button 
                            id="leaveBtn" 
                            onClick={() => handleLeaveGroup(group.group_id)}
                        >
                            Leave
                        </button>
                    </div>
                </div>
            );
            })}

            {/* Conditionally render the modal */}
            {showModal && (
                <GroupCreatorModal 
                    onClose={() => setShowModal(false)} 
                    onGroupCreated={handleCreateSuccess}
                    onDone={handleModalDone}
                />
            )}

            {infoModalGroup && (
                <GroupInfoModal
                    groupId={infoModalGroup.group_id}
                    groupName={infoModalGroup.group_name}
                    onClose={() => setInfoModalGroup(null)}
                />
            )}
        </section>
    );
}
