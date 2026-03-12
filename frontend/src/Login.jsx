/*
File: Login.jsx
Purpose: Renders the public login/onboarding entry page and starts Google OAuth login.
Creation Date: 2026-02-12
Initial Author(s): Anna Norris

System Context:
This file is part of the Social Schedule frontend authentication and onboarding
experience. It serves as the first screen users see, provides product context,
and routes users into backend OAuth authentication.
*/

/*
Library: react
Purpose: Provides component rendering and Hooks for local state and side effects.
Reason Included: Login is implemented as a functional React component using
`useState` and `useEffect`.
*/
import React, { useState, useEffect } from 'react';
import './css/login.css';

/**
 * Login page component for initiating OAuth and displaying app overview content.
 *
 * @returns {JSX.Element} Login screen with Google auth button and feature descriptions.
 */
export default function Login() {
  // Handles users logging in or creating an account, first page users will see
  const [errorMsg, setErrorMsg] = useState('');

  /**
   * Reads auth error query params once on mount and surfaces permission guidance.
   *
   * @returns {void}
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error === "calendar_permissions_required") {
      setErrorMsg("Please grant calendar permissions to access this app.")
    }
  }, []);


    /**
     * Redirects the user to the backend Google OAuth start endpoint.
     *
     * @returns {void}
     */
    const handleLogin = () => {
      // fix localhost redirect issues with different frontend/backend ports
      const baseURL = process.env.BACKEND_URL || '';
      window.location.href = `${baseURL}/auth/google`;
  };

  return (
      <>
      {/* Header for logo */}
      <div className="login-container">
        {errorMsg && <p style={{color: 'red'}}>{errorMsg}</p>}
        <header>
          <p id="logo">Social Scheduler</p>
          <p id="beta">beta</p>
        </header>

      {/* contains button and columns with some features */}
        <body>
          <section id="auth">
            <button id="loginBtn" onClick={handleLogin}>Continue with Google!</button>
          </section>
          <div className="columns">
            <div className='column'>
              <h3>Import Your Google Calendars</h3>
              <p>
                With Social Scheduler, you can import your Google calendars to 
                start making scheduling easier. Just press the Continue with Google 
                to create a new account and choose which calendars you want to use for 
                scheduling! You'll be able to add your own special events without using
                Google calendar too. 
              </p>
              <p>
                Try clicking on any event to set its priority!
              </p>
            </div>
            <div className='column'>              
              <h3>Create Groups</h3>
              <p>
                Have you ever struggled with scheduling study sessions or hangouts With
                your friends and classmates? This website aims to make the process that much
                smoother. You can create groups and invite people to them. Send them a shareable 
                link to invite them, or, if you know their username, let the app send them an email 
                for you!
              </p>
              </div>
            <div className='column'>
              <h3>Petition a Time</h3>
              <p>
                With an existing group, you can "petition" your group for a time to meet up. 
                View your group's availability and find a time where everyone can meet based on
                how much you want to prioritize your meetup.
                Everybody can stay on the same page as everyone gets to see exactly where the 
                petitioned time lands on their calendar. All of your group members can accept or 
                decline a petition.
              </p>
            </div>
          </div>
        </body>
      </div>
      </>
  );
}