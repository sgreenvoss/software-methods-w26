/*
File: UsernameCreation.jsx
Purpose: Provides the onboarding flow where a new user creates a username and
selects one or more calendars to import before entering the main app.
Creation Date: 2026-02-18
Initial Author(s): Anna Norris

System Context:
This file is part of the Social Schedule frontend onboarding system. It sits
between login and the main dashboard, validating username input and collecting
initial calendar selections for backend setup.
*/

/*
Library: react
Purpose: Supplies functional component rendering and Hooks for local state and effects.
Reason Included: This file uses `useState` for onboarding state and `useEffect` for initial data loading.
*/
import React, { useState, useEffect } from 'react';

/*
Module: ./api.js
Purpose: Exposes API helper functions for GET/POST requests.
Reason Included: Username creation and calendar selection are submitted/fetched via backend endpoints.
*/
import { apiGet, apiPost } from './api.js';

/*
Component: CalendarSelectionModal
Purpose: Displays selectable calendars and confirmation controls.
Reason Included: The second onboarding step is rendered in this modal.
*/
import CalendarSelectionModal from './components/CalendarSelectionModal.jsx'; 

/**
 * Username onboarding component that validates username input and collects
 * initial calendar selections before redirecting into the app.
 *
 * @returns {JSX.Element} Onboarding page and calendar-selection modal.
 */
export default function UsernameCreation() {
    const [username, setUsername] = useState('');
    const [errors, setErrors] = useState([]);
    const [step, setStep] = useState('username'); // 'username' or 'calendars'
    const [isLoading, setIsLoading] = useState(false);

    const [calendars, setCalendars] = useState([]);
    const [selectedCals, setSelectedCals] = useState([]);

    /**
     * Toggles calendar selection in local state for the onboarding modal.
     *
     * @param {{id: string|number, summary?: string, displayName?: string}} calendar - Calendar object to add/remove.
     * @returns {void}
     */
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

    /**
     * Validates username input and advances onboarding to the calendar step.
     *
     * @param {React.FormEvent<HTMLFormElement>} e - Form submission event.
     * @returns {Promise<void>} Resolves after validation and state updates.
     */
    const handleSubmit = async (e) => {
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

    /**
     * Submits username and selected calendars to backend onboarding endpoints.
     *
     * @returns {Promise<void>} Resolves after submission workflow and loading state cleanup.
     */
    const handleSelectCalendars = async () => {
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

    /**
     * Returns the user from the calendar step back to username entry.
     *
     * @returns {void}
     */
    const handleBackToUsername = () => {
        setStep('username');
        setErrors([]);
    }

    /**
     * Loads available calendars once on component mount for selection in step two.
     *
     * @returns {void}
     */
    useEffect(() => {
        /**
         * Fetches calendars for the current user and normalizes fields for modal display.
         *
         * @returns {Promise<void>} Resolves after calendars are loaded into component state.
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