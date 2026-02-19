import React, { useState } from 'react';
import './css/login.css';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''; // Gemini assisted fix for local deployment
// handles login
export default function Login() {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    
    console.log("loading login page");
    
    const handleLogin = () => {
        if (!username) {
            setError('Please enter username.');
            return;
        }
        // Gemini assisted fix for local deployment
        window.location.href = `${BACKEND_URL}/auth/google?username=${encodeURIComponent(username)}`;
    };

    return (
        <>
        <div className="login-container">
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
            />
            {error && <p style={{color: 'red'}}>{error}</p>}
          </section>

          <section id="auth">
            <button id="loginBtn" onClick={handleLogin}>Continue with Google</button>
          </section>
        </div>
        </>
    );
}