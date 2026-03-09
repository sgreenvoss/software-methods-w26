import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from './api.js';
import CalendarSelectionModal from './components/CalendarSelectionModal.jsx'; 

export default function UsernameCreation() {
    const [username, setUsername] = useState('');
    const [errors, setErrors] = useState([]);
    const [step, setStep] = useState('username'); // 'username' or 'calendars'
    const [isLoading, setIsLoading] = useState(false);

    const [calendars, setCalendars] = useState([]);
    const [selectedCals, setSelectedCals] = useState([]);

    const handleCheckboxChange = (calendar) => {
        if (selectedCals.some(cal => cal.id === calendar.id)) {
            // remove
            setSelectedCals((prev) => prev.filter((cal) => cal.id !== calendar.id));
        } else {
            // add
            setSelectedCals((prev) => [...prev, calendar]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const usernameSize = /^.{4,16}$/;
        const usernameSymbols = /^[a-zA-Z0-9_.]+$/

        const validationErrors = [];
        if (!usernameSize.test(username)) {
            validationErrors.push('Username must be between 4-16 characters');
        }
        if (!usernameSymbols.test(username)) {
            validationErrors.push('Username must only contain alphabetic letters, digits, and \'_\' and \'.\'');
        }
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }
        
        setErrors([]);
        setStep('calendars');
    }

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

    const handleBackToUsername = () => {
        setStep('username');
        setErrors([]);
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