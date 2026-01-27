// at midnight I have decided to do a checkin with ChatGPT about how my understanding
// is lacking the Software Engineering structure
// (01/26/26): Asked what I was misunderstanding and how to allign with the SRS SDS
// Will review (01/27/26)

import { AvailabilityQuery, BlockingLevel, EventInterval, SlotResult, UserId } from "./types";

// --- THE SEAM (Policy) ---
// This is the definition of "How we determine priority."
// MVP Implementation: Always return B3.
// Future Implementation: Look up in Map, DB, or Rule Engine.
export type BlockingResolver = (userId: UserId, eventRef: string) => BlockingLevel;

const defaultResolver: BlockingResolver = () => BlockingLevel.B3;

// --- THE MECHANISM (Pure Logic) ---
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart; // half-open overlap
}

export function computeGroupSlotLevels(params: {
  query: AvailabilityQuery;
  eventsByUser: Map<UserId, EventInterval[]>;
  // Dependency Injection: We allow the caller to tell us HOW to prioritize.
  // If they don't, we default to the MVP behavior (B3).
  resolveBlockingLevel?: BlockingResolver; 
}): SlotResult[] {
  const { query, eventsByUser } = params;
  
  // Use the injected policy or the default MVP policy
  const resolve = params.resolveBlockingLevel ?? defaultResolver;

  const Gms = query.granularityMinutes * 60_000;
  const start = query.windowStartUtcMs;
  const end = query.windowEndUtcMs;

  // 1. Validation (Design by Contract)
  if (!(start < end)) throw new Error("windowStart must be < windowEnd");
  if ((end - start) % Gms !== 0) {
    throw new Error("window length must be a multiple of slot granularity");
  }

  // 2. Slot Initialization
  const slotCount = (end - start) / Gms;
  const slots: SlotResult[] = Array.from({ length: slotCount }, (_, k) => {
    const s0 = start + k * Gms;
    return {
      slotStartUtcMs: s0,
      slotEndUtcMs: s0 + Gms,
      groupBlockingLevel: BlockingLevel.B1 // Default to Free
    };
  });

  // 3. Evaluation Loop (The Pure Mechanism)
  for (let k = 0; k < slots.length; k++) {
    const s = slots[k];

    outer: for (const [userId, events] of eventsByUser.entries()) {
      for (const e of events) {
        if (!overlaps(e.startUtcMs, e.endUtcMs, s.slotStartUtcMs, s.slotEndUtcMs)) continue;

        // CALL THE SEAM: Ask the resolver for the level.
        // The loop does not know "why" this is the level.
        const level = resolve(userId, e.eventRef);
        
        // Max aggregation
        if (level > s.groupBlockingLevel) {
          s.groupBlockingLevel = level;
        }

        // Optimization: If we hit the ceiling (B3), we can stop checking this slot.
        if (s.groupBlockingLevel === BlockingLevel.B3) break outer; 
      }
    }
  }

  return slots;
}