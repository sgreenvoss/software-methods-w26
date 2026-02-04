let algorithmPromise = null;

async function loadAlgorithm() {
  if (!algorithmPromise) {
    algorithmPromise = import("./algorithm.js");
  }
  return algorithmPromise;
}

async function computeAvailabilityBlocks(args) {
  const mod = await loadAlgorithm();
  return mod.computeAvailabilityBlocks(args);
}

module.exports = {
  computeAvailabilityBlocks,
};
