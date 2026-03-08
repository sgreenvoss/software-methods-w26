import React, { createContext, useState } from 'react';

export const ErrorContext = createContext();

export function ErrorProvider({ children }) {
    const [error, setError] = useState(null);

    const clearError = () => setError(null);

    return (
        <ErrorContext.Provider value={{ error, setError, clearError }}>
            {children}
        </ErrorContext.Provider>
    );
}
