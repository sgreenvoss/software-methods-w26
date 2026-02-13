import React, { useState } from 'react';
import Calendar from './components/Calendar/Calendar';
import Groups from './components/Groups/Groups';

// main page, displays option for group view or personal calendar view
export default function Main() {
    const [view, setView] = useState('calendar');

    // send request for logout
    const handleLogout = () => {
        window.location.href = '/logout';
    }

    // displays two buttons that will bring up either Calendar or Group
    return (
        <div>
            <button onClick={() => setView('calendar')} id="calBtn">Calendar View</button>
            <button onClick={() => setView('groups')} id="groupsBtn">Group View</button>
            <button onClick={handleLogout} id="logoutBtn">Logout</button>

            {view === 'calendar' ? <Calendar /> : <Groups />}
        </div>
    )
}