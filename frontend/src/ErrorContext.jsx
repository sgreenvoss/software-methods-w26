/*
ErrorContext.jsx
The purpose of this file is to create a context for error page handling
Created on 2026-3-6 by Anna Norris
*/

import React, { createContext, useState } from 'react';

// create a context for any errors
export const ErrorContext = createContext();

// provide the context to provide error state to rest of the components
export function ErrorProvider({ children }) {
    const [error, setError] = useState(null);

    // reset the error
    const clearError = () => setError(null);

    return (
        /* error code */
        <ErrorContext.Provider value={{ error, setError, clearError }}>
            {children}
        </ErrorContext.Provider>
    );
}
