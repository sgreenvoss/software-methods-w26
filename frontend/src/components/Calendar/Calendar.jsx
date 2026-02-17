import React, { useState, useEffect } from 'react';
import { apiGet } from '../../api';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

// main calendar view
export default function UserCalendar() {
    const [events, setEvents] = useState([]);

    // Fetch all of the events from api/events and display them on component load
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const data = await apiGet('/api/events');
                const eventsWithDates = data.map(event => ({
                    ...event, // spread operator that copies all pros from event obj to new
                    // ensure start and end are Date objects
                    start: new Date(event.start),
                    end: new Date(event.end)
                }));
                setEvents(eventsWithDates);
            } catch (error) {
                console.error('Error fetching events:', error);
            }
        };

        fetchEvents();
    }, []);

    return (
        <div style={{ height: '100vh' }}>
            <Calendar 
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
            />
        </div>
    )
}