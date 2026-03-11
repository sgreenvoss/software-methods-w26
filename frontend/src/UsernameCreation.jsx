/*
UsernameCreation.jsx
Page for new users to create their username and choose calendars to import
Created on 2026-2-18 by Anna Norris
Updated to include calendar selection
*/

import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from './api.js';
import CalendarSelectionModal from './components/CalendarSelectionModal.jsx'; 

export default function UsernameCreation() {
    /*
    Main page to handle username creation
    Once user creates a username and chooses at least one calendar, they are 
    redirected to main
    */
    const [username, setUsername] = useState('');
    const [errors, setErrors] = useState([]);
    const [step, setStep] = useState('username'); // 'username' or 'calendars'
    const [isLoading, setIsLoading] = useState(false);

    const [calendars, setCalendars] = useState([]);
    const [selectedCals, setSelectedCals] = useState([]);

    const handleCheckboxChange = (calendar) => {
        // with each calendar, handle whether user selects or deselects calendar choice
        if (selectedCals.some(cal => cal.id === calendar.id)) {
            // remove
            setSelectedCals((prev) => prev.filter((cal) => cal.id !== calendar.id));
        } else {
            // add
            setSelectedCals((prev) => [...prev, calendar]);
        }
    };

    const handleSubmit = async (e) => {
        /* 
        handle input for username and submission
        checks whether username is valid based on validation rules
        gets the current input and moves on to calendars modal
        */
        e.preventDefault();

        // usernames must be 4-16 characters and include only alphabetic chars, _, and .
        const usernameSize = /^.{4,16}$/;
        const usernameSymbols = /^[a-zA-Z0-9_.]+$/

        // test if input is valid
        const validationErrors = [];
        if (!usernameSize.test(username)) {
            validationErrors.push('Username must be between 4-16 characters');
        }
        if (!usernameSymbols.test(username)) {
            validationErrors.push('Username must only contain alphabetic letters, digits, and \'_\' and \'.\'');
        }
        // if the submission is not valid, display what is wrong
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }
        
        // move on to calendars modal
        setErrors([]);
        setStep('calendars');
    }

    const handleSelectCalendars = async () => {
        /*
        sends the selected calendars to the backend
        */
        if (selectedCals.length < 1) {
            setErrors(['Please select at least one calendar.']);
            return;
        }

        setIsLoading(true);
        try {
            // Create username AND select calendars together
            const usernameRes = await apiPost('/api/create-username', { username });
            if (usernameRes.success) {
                await apiPost('/api/select-calendars', { calendars: selectedCals });
                window.location.href = '/';
            } else {
                setErrors(usernameRes.errors);
            }
        } catch (err) {
            console.error('Error:', err);
            setErrors(['An error occurred.']);
        } finally {
            setIsLoading(false);
        }
    }

    const handleBackToUsername = () => {
        setStep('username');
        setErrors([]);
    }

    useEffect(() => {
        /*
        immediately upon page load, get the calendars for the user and set calendars for modal
        */
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
        <div className="onboarding-container">
            <div className="login-container">
                <header>
                    <p id="logo">Social Scheduler</p>
                    <p id="beta">beta</p>
                </header>
            </div>
            {step === 'username' ? (
                <div className='username-creator'>
                    <h1>Create Your Username</h1>
                    <form onSubmit={handleSubmit}>
                        <label>
                            Username:
                            <input 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isLoading}
                                style={{marginLeft:'1em'}}
                            />
                            <button type="submit" disabled={isLoading} style={{marginLeft:'1em'}}>
                                {isLoading ? 'Creating...' : 'Next'}
                            </button>
                        </label>
                        {errors && errors.map((err, idx) => (
                            <p key={idx} style={{color: 'red'}}>{err}</p>
                        ))}
                    </form>
                    <ul>
                        <li>Username must be between 4 and 16 characters long.</li>
                        <li>Username may not contain special characters except for '.' and '_'</li>
                    </ul>
                </div>
            ) : null}
        </div>
        <CalendarSelectionModal
            isOpen={step === 'calendars'}
            calendars={calendars}
            selectedCals={selectedCals}
            onSelectCalendar={handleCheckboxChange}
            onConfirm={handleSelectCalendars}
            onBack={handleBackToUsername}
            isLoading={isLoading}
            errors={errors}
        />
        </>
    )
}