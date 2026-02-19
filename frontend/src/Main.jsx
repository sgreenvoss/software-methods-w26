import React, { useState } from 'react';
import Calendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';
import './css/main.css';

export default function Main() {
    const [view, setView] = useState('calendar');
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [groupsList, setGroupsList] = useState([]); 

    // 1. Move fetchGroups INSIDE so it can see setGroupsList
    const fetchGroups = async () => {
        try {
            // 1. Hit your ACTUAL endpoint
            const response = await apiGet('/user/groups'); 
            
            // 2. Your backend returns { success: true, groups: [...] }
            // We need to extract the groups array specifically.
            if (response && response.success && Array.isArray(response.groups)) {
                setGroupsList(response.groups);
            } else {
                setGroupsList([]);
            }
        } catch (err) {
            console.error("Groups fetch failed", err);
            setGroupsList([]);
        }
    };

    // 2. Move handleLogout INSIDE
    const handleLogout = async () => {
        try {
            await apiPost('/api/logout'); 
            window.location.href = '/login'; 
        } catch (err) {
            window.location.href = '/login'; 
        }
    };

    // 3. Effect calls the internal function
    useEffect(() => {
        fetchGroups();
    }, []);

    console.log("2. Main.jsx current selectedGroupId:", selectedGroupId);
    return (
        <div>
            <section id="logout">
                <button onClick={handleLogout} id="logoutBtn">Logout</button>
            </section>
            <header>
                <p id="logo">Social Schedule</p>
                <p id="beta">beta</p>
            </header>

            <header>
                <button onClick={() => setView('groups')} id="groupsBtn">Group View</button>
                <button onClick={() => setView('calendar')} id="calendarBtn">Calendar View</button>
            </header>

            {view === 'calendar' ? <Calendar /> : <Groups />}
        </div>
    );
}