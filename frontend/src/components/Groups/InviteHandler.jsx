/*
File: InviteHandler.jsx
Purpose: This component handles the user clicking on the shareable
    link to join a group.
Date Created: 2026-02-26
Initial Author(s): David Haddad

System Context:
This is part of the invitation module and frontend system.
Handles users joining a group via shareable link.
User can be sent to login and then join if not valid token
*/

// React import - required for rendering the modal component and JSX
import React, { useEffect, useContext } from 'react';

// router import - required for navigating between pages
import { useLocation, useNavigate } from 'react-router-dom';

// endpoints
import { apiGet } from '../../api';
import { ErrorContext } from '../../ErrorContext';

/**
 * 
 * 
 * @returns {@JSX.Element} - 
 */
export default function InviteHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setError } = useContext(ErrorContext);

  // handle the user joining a group from invite modal
  useEffect(() => {
    const handleJoin = async () => {
      // 1. Extract the 'q' token from the URL
      const params = new URLSearchParams(location.search);
      const token = params.get('q');

      if (!token) {
        console.error("No token found in invitation link.");
        setError("No token provided in invitation link.")
        return;
      }

      try {
        // 2. Hand the token to the backend
        // This endpoint will handle both logged-in and logged-out users
        const response = await apiGet(`/api/groups/join?token=${token}`);

        if (response.success) {
          console.log("Successfully joined group!");
          navigate('/'); // Go to dashboard
        } else if (response.needsLogin) {
          // Backend saved the token to session, now we just need to log in
          navigate('/login');
        }
      } catch (err) {
        console.error("Failed to process invitation:", err);
        setError(err.message);
      }
    };

    handleJoin();
  }, [location, navigate]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Processing your invitation...</h2>
      <p>Please wait a moment.</p>
    </div>
  );
}