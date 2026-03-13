/*
File: index.js
Purpose: ESM barrel entrypoint that re-exports the availability algorithm public API.
Creation Date: 2026-02-02
Initial Author(s): David Haddad

System Context: 
This file is the package-level import entry used by consumers of the algorithm module.
It forwards exports from algorithm.js so callers can import from the package root while keeping
algorithm implementation details isolated in the core module.
*/

export * from "./algorithm.js";
