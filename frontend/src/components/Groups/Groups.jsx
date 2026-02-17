import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../api';
import CreateGroupModal  from './GroupCreator';

// Main groups view
export default function Groups() {
    const [view, setView] = useState('list');
    const [groups, setGroups] = useState([]);

    const fetchGroups = async () => {
        try {
            const data = await apiGet('/user/groups');
            setGroups(data['groups']);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    // update server + view when user leaves group
    const handleLeaveGroup = async (groupId) => {
        try {
            const response = await apiPost('/group/leave', { groupId: groupId });
            fetchGroups();
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    }

    // for creating a new group, need to update list
    const handleGroupCreated = () => {
        setView('list');
        fetchGroups();
    }

    // get existing groups for user on load
    useEffect(() => {
        fetchGroups();
    }, []);


    return (
        <div>
            <button onClick={() => setView('creategroupmodal')}>Create New Group</button>
            {groups.map(group => (
                <div key={group.group_id}>
                    <h3>{group.group_name}</h3>
                    <button onClick={() => {setSelectedGroup(group); setView('calendar'); }}>
                        View
                    </button>
                    <button onClick={() => handleLeaveGroup(group.group_id)}>
                        Leave
                    </button>
                </div>
            ))}

            {view === 'creategroupmodal' && (
                <CreateGroupModal 
                isOpen={view === 'creategroupmodal'}
                onClose={() => setView('list')}
                onGroupCreated={handleGroupCreated}
                />
            )}
        </div>
    );
}