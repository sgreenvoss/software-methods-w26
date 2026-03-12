/*
File: ErrorContext.jsx
Purpose: Defines shared error state context and provider utilities for app-wide
error reporting and reset behavior.
Creation Date: 2026-03-06
Initial Author(s): Anna Norris

System Context:
This file is part of the Social Schedule frontend state infrastructure. It
supplies globally accessible error state used by top-level rendering logic to
show server/error pages and clear errors after recovery.
*/

/*
Library: react
Purpose: Provides Context and state hooks for shared error-state management.
Reason Included: This file defines a context value and provider component using
`createContext` and `useState`.
*/
import React, { createContext, useState } from 'react';

// create a context for any errors
export const ErrorContext = createContext();

/**
 * Provides global error state and helper actions to descendant components.
 *
 * @param {{children: React.ReactNode}} props - Provider props containing nested UI tree.
 * @returns {JSX.Element} Context provider wrapping all child components.
 */
export function ErrorProvider({ children }) {
    const [error, setError] = useState(null);

    /**
     * Clears the current global error.
     *
     * @returns {void}
     */
    const clearError = () => setError(null);

    return (
        /* error code */
        <ErrorContext.Provider value={{ error, setError, clearError }}>
            {children}
        </ErrorContext.Provider>
    );
}
