import React, { useState } from 'react';
import Calendar from './components/Calendar/CustomCalendar';
import Groups from './components/Groups/Groups';
import './css/main.css';

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
    )
}