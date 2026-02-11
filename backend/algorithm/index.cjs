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

async function computeAvailabilityBlocksAllViews(args) {
  const mod = await loadAlgorithm();
  return mod.computeAvailabilityBlocksAllViews(args);
}

async function toSingleViewBlocks(blocksMulti, chosen) {
  const mod = await loadAlgorithm();
  return mod.toSingleViewBlocks(blocksMulti, chosen);
}

module.exports = {
  computeAvailabilityBlocks,
  computeAvailabilityBlocksAllViews,
  toSingleViewBlocks,
};
