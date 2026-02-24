import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../api';

export default function InviteHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleJoin = async () => {
      // 1. Extract the 'q' token from the URL
      const params = new URLSearchParams(location.search);
      const token = params.get('q');

      if (!token) {
        console.error("No token found in invitation link.");
        navigate('/');
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
        navigate('/');
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