import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from './api.js';
import './css/usernameCreation.css'

export default function UsernameCreation() {
    const [username, setUsername] = useState('');
    const [errors, setErrors] = useState([]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const usernameSize = /^.{4,16}$/;
        const usernameSymbols = /^[a-zA-Z0-9_.]+$/

        const errors = [];
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
                window.location.href = '/';
            } else {
                setErrors(res.errors);
            }
        } catch (err) {
            console.error('Error:', err);
            setErrors(['An error occurred.']);
        }
    }
 
    return (
        <>
        <form onSubmit={handleSubmit}>
            <label>
                Username:
                <input onChange={(e) => setUsername(e.target.value)}/>
                <button type="submit">Submit</button>
            </label>
            {errors && errors.map((err, idx) => (
                <p id='error' key={idx}>{err}</p>
            ))}
        </form>
        <ul>
            <li>Username must be between 4 and 16 characters long.</li>
            <li>Username may not contain special characters except for '.' and '_'</li>
        </ul>
        </>
    )
}