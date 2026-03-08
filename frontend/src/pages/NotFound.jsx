import React from 'react';

export default function NotFound() {
    return (
        <div className="error-page">
        <div className="error-container">
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <a href="/" className="error-button">Go Home</a>
        </div>
        </div>
  );
}