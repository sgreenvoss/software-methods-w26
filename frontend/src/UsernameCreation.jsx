import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from './api.js';

export default function UsernameCreation() {
    const [username, setUsername] = useState('');
    const [errors, setErrors] = useState([]);

    const [calendars, setCalendars] = useState([]);
    const [selectedCals, setSelectedCals] = useState([]);

    const handleCheckboxChange = (e) => {
        const { value, checked } = e.target;
        const calendar = calendars.find(cal => cal.id === value);

        if (checked) {
            // add calendar to array if checked
            setSelectedCals((prev) => [...prev, calendar]);
        } else {
            // remove value from array if unchecked
            setSelectedCals((prev) => prev.filter((cal) => cal.id !== value));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const usernameSize = /^.{4,16}$/;
        const usernameSymbols = /^[a-zA-Z0-9_.]+$/

        const errors = [];
        if (selectedCals.length < 1) {
            errors.push('Please select at least one calendar.')
            setErrors(errors);
            return;
        }
        if (!usernameSize.test(username)) {
            errors.push('Username must be between 4-16 characters');
        }
        if (!usernameSymbols.test(username)) {
            errors.push('Username must only contain alphabetic letters, digits, and \'_\' and \'.\'');
        }
        if (errors.length > 0) {
            setErrors(errors);
            return;
        }

        try {
            const res = await apiPost('/api/create-username', { username });
            if (res.success) {
                await apiPost('/api/select-calendars', { calendars: selectedCals });
                window.location.href = '/';
            } else {
                setErrors(res.errors);
            }
        } catch (err) {
            console.error('Error:', err);
            setErrors(['An error occurred.']);
        }
    }

    useEffect(() => {
        const getCals = async () => {
            const cals = await apiGet('/api/calendars');
            const updatedCals = cals.map((cal) => {
                return {
                    id: cal.id,
                    summary: cal.summary,
                    displayName: cal.primary ? 'primary (Your name on Google Calendar)' : cal.summary,
                    checked: false
                };
            });
            setCalendars(updatedCals);
        }
        getCals();
    }, [])
 
    return (
        <>
        <form onSubmit={handleSubmit}>
            <label>
                Username:
                <input onChange={(e) => setUsername(e.target.value)}/>
                <button type="submit">Submit</button>
            </label>
            {errors && errors.map((err, idx) => (
                <p key={idx} style={{color: 'red'}}>{err}</p>
            ))}
        </form>
        <ul>
            <li>Username must be between 4 and 16 characters long.</li>
            <li>Username may not contain special characters except for '.' and '_'</li>
        </ul>

        <p>
            IMPORTANT: Please select the calendars you wish to import from your Google account
            This may not be changed.
        </p>
        {calendars.map((calendar) => (
            <div key={calendar.id}>
                <label>
                    <input
                        type="checkbox"
                        value={calendar.id}
                        checked={selectedCals.some(cal => cal.id === calendar.id)}
                        onChange={handleCheckboxChange}
                    />
                    {calendar.displayName}
                </label>
            </div>
        ))}
        <div>
            <p>Selected Calendars: {selectedCals.map(cal => cal.displayName).join(', ')}</p>
        </div>
        </>
    )
}