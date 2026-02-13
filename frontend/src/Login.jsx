import React, { useState } from 'react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    
    console.log("loading login page");
    
    const handleLogin = () => {
        if (!username || username.length > 12) {
            setError('Username must be 1-12 characters');
            return;
        }
        window.location.href = `/auth/google?username=${encodeURIComponent(username)}`;
    };

    return (
        <>
          <header>
            <p id="logo">Social Scheduler</p>
            <p id="beta">beta</p>
          </header>

          <section id="signUp">
            <label htmlFor="username">Username:</label>
            <input 
                type="text" 
                id="username" 
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength="12"
            />
            {error && <p style={{color: 'red'}}>{error}</p>}
          </section>

          <section id="auth">
            <button id="loginBtn" onClick={handleLogin}>Continue with Google</button>
          </section>
        </>
    );
}