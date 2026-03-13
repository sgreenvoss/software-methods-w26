/*
File: index.cjs
Purpose: Loads the ESM event-management module for CommonJS callers.
This keeps the package export shape consistent with the algorithm module.
Date Created: 2026-02-06
Initial Author(s): David Haddad

(Not used in final project)
*/

let modulePromise = null;

async function loadModule() {
  // Cache the dynamic import so CommonJS callers reuse one module instance.
  if (!modulePromise) {
    modulePromise = import("./index.js");
  }
  return modulePromise;
}

async function createEventManagementModule(options) {
  const mod = await loadModule();
  return mod.createEventManagementModule(options);
}

module.exports = {
  createEventManagementModule,
};
