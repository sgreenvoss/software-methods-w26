import React, { useState } from 'react';
import './css/login.css';
const BACKEND_URL = process.env.BACKEND_URL || ''; // Gemini assisted fix for local deployment
// handles login
export default function Login() {
    
    const handleLogin = () => {
        // fix localhost redirect issues with different frontend/backend ports
        const baseURL = process.env.BACKEND_URL || '';
        window.location.href = `${baseURL}/auth/google`;
    };

    return (
        <>
        <div className="login-container">
          <header>
            <p id="logo">Social Scheduler</p>
            <p id="beta">beta</p>
          </header>

          <section id="auth">
            <button id="loginBtn" onClick={handleLogin}>Continue with Google</button>
          </section>
        </div>
        </>
    );
}