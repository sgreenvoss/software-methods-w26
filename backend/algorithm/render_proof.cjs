/**
 * render_proof.cjs
 *
 * A tiny, dependency-free smoke test intended to be run on Render (or anywhere)
 * to prove:
 *   1) the algorithm module loads in a CommonJS context (like backend/server.js)
 *   2) priority blocking semantics (B1/B2/B3) behave as specified
 *   3) multi-view routing/projection matches single-view output
 *
 * Run (from repo root):
 *   node backend/algorithm/render_proof.cjs
 */

const assert = require("assert/strict");

function iso(ms) {
  return new Date(ms).toISOString();
}

async function main() {
  // Important: require(".") exercises this package's "exports" mapping.
  // In production (Render), backend code can do: require("./algorithm")
  // and get the CommonJS wrapper.
  const alg = require(".");

  const base = Date.UTC(2026, 0, 1, 10, 0, 0, 0);
  const oneMin = 60 * 1000;
  const t = (minutes) => base + minutes * oneMin;

  const windowStartMs = t(0);
  const windowEndMs = t(15);

  const participants = [
    { userId: "u1", events: [{ startMs: t(0), endMs: t(15), blockingLevel: "B1" }] },
    { userId: "u2", events: [{ startMs: t(0), endMs: t(15), blockingLevel: "B2" }] },
    { userId: "u3", events: [{ startMs: t(0), endMs: t(15), blockingLevel: "B3" }] },
    // Missing blockingLevel must normalize to B3.
    { userId: "ux", events: [{ startMs: t(0), endMs: t(15) }] },
  ];

  const b3 = (await alg.computeAvailabilityBlocks({
    windowStartMs,
    windowEndMs,
    participants,
    granularityMinutes: 15,
    priority: "B3",
  }))[0];
  assert.deepEqual(b3.busyUserIds, ["u3", "ux"]);
  assert.deepEqual(b3.freeUserIds, ["u1", "u2"]);

  const b2 = (await alg.computeAvailabilityBlocks({
    windowStartMs,
    windowEndMs,
    participants,
    granularityMinutes: 15,
    priority: "B2",
  }))[0];
  assert.deepEqual(b2.busyUserIds, ["u2", "u3", "ux"]);
  assert.deepEqual(b2.freeUserIds, ["u1"]);

  const b1 = (await alg.computeAvailabilityBlocks({
    windowStartMs,
    windowEndMs,
    participants,
    granularityMinutes: 15,
    priority: "B1",
  }))[0];
  assert.deepEqual(b1.busyUserIds, ["u1", "u2", "u3", "ux"]);
  assert.deepEqual(b1.freeUserIds, []);

  const all = await alg.computeAvailabilityBlocksAllViews({
    windowStartMs,
    windowEndMs,
    participants,
    granularityMinutes: 15,
  });

  for (const chosen of ["B1", "B2", "B3"]) {
    const projected = await alg.toSingleViewBlocks(all, chosen);
    const single = await alg.computeAvailabilityBlocks({
      windowStartMs,
      windowEndMs,
      participants,
      granularityMinutes: 15,
      priority: chosen,
    });
    assert.deepEqual(projected, single);
  }

  const out = {
    ok: true,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    window: { start: iso(windowStartMs), end: iso(windowEndMs) },
    sample: { B1: b1, B2: b2, B3: b3 },
  };

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

