import React, { useState, useEffect, act } from 'react';
import { apiGet, apiPost } from '../../api.js';
import GroupCreatorModal from './GroupCreator.jsx';
import GroupInfoModal from './GroupInfo.jsx';
import '../../css/groups.css';
import '../../css/groupsModal.css';

export default function Groups( {onSelectGroup, onOpenPetition, refreshSignal = 0} ) {
    const [groups, setGroups] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [infoModalGroup, setInfoModalGroup] = useState(null);

    const [activeGroupID, setActiveGroupId] = useState(null);
    // Function to fetch groups (replaces the initial apiGet)
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
        } finally {
            setLoading(false);
        }
    };

    // Load groups when component mounts and when parent asks for a refresh.
    useEffect(() => {
        fetchGroups();
    }, [refreshSignal]);

    const handleLeaveGroup = async (groupId) => {
        console.log("leaving group", groupId);
        try {
            await apiPost("/group/leave", { groupId: groupId });
            // Refresh list after leaving
            fetchGroups();
            if (activeGroupID === groupId) {
                setActiveGroupID(null);
                onSelectGroup(null);
                // Deselect group if it was the active one
            }
        } catch (error) {
            console.error("Failed to leave group", error);
        }
    };

    const handleCreateSuccess = () => {
        // Refresh immediately after create success; modal remains open for invite sharing.
        fetchGroups();
    };

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
                const isActive = activeGroupID === group.group_id;
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
                                    // If already active, turn it off
                                    setActiveGroupId(null);
                                    onSelectGroup(null); // Tell Main to clear the ID
                                } else {
                                    // If not active, turn it on
                                    setActiveGroupId(group.group_id);
                                    onSelectGroup(group.group_id); // Tell Main to fetch this ID
                                }
                            }}
                        >
                            {isActive ? "Hide" : "View"}
                        </button>

                        <button 
                            id="petitionBtn" 
                            onClick={() => {
                                console.log("Create petition for group", group.group_id);
                                onOpenPetition(group.group_id); // handoff to Main to open petition sidebar with this group ID
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
            )})}

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
                    onClose={() => setInfoModalGroup(null)} // Closes modal on click
                />
            )}
        </section>
    );
}
