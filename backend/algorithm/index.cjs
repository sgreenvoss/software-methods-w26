/*
File: index.cjs
Purpose: CommonJS compatibility entrypoint that exposes async wrappers for the algorithm API.
Creation Date: 2026-02-02
Initial Author(s): David Haddad

System Context: 
This file bridges CommonJS consumers to the ESM implementation in algorithm.js.
It lazy-loads the algorithm module once via dynamic import and re-exports key functions through
module.exports so require() callers can use the same compute API as ESM import callers.
*/

let algorithmPromise = null;

async function loadAlgorithm() {
  // Cache the dynamic import so repeated calls reuse the same module instance.
  if (!algorithmPromise) {
    algorithmPromise = import("./algorithm.js");
  }
  return algorithmPromise;
}

async function computeAvailabilityBlocks(args) {
  // Forward the single-view helper through the ESM module.
  const mod = await loadAlgorithm();
  return mod.computeAvailabilityBlocks(args);
}

async function computeAvailabilityBlocksAllViews(args) {
  // Forward the multi-view helper through the ESM module.
  const mod = await loadAlgorithm();
  return mod.computeAvailabilityBlocksAllViews(args);
}

async function toSingleViewBlocks(blocksMulti, chosen) {
  // Forward the projection helper through the ESM module.
  const mod = await loadAlgorithm();
  return mod.toSingleViewBlocks(blocksMulti, chosen);
}

module.exports = {
  computeAvailabilityBlocks,
  computeAvailabilityBlocksAllViews,
  toSingleViewBlocks,
};
