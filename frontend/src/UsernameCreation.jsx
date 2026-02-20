import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from './api.js';

export default function UsernameCreation() {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const allowed = /^[A-Za-z0-9._]{4,16}$/
        if (!allowed.test(username)) {
            setError('Username invalid')
            return;
        }

        try {
            const res = await apiPost('/api/create-username', { username });

            if (res.success) {
                window.location.href = '/';
            } else {
                setError(res.error);
            }
        } catch (err) {
            console.error('Error:', err);
            setError('An error occurred.');
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
            {error && <p>{error}</p>}
        </form>
        <ul>
            <li>Username must be between 4 and 16 characters long.</li>
            <li>Username may not contain special characters except for '.' and '_'</li>
        </ul>
        </>
    )
}