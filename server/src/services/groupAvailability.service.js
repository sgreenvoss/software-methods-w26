import { computeAvailabilityBlocks } from '../../../algorithm/algorithm.js';
import { listGroupMembers } from '../models/group_match.model.js';
import { getEventsForGroupOverlappingWindow } from '../models/cal_event.model.js';

function toEpochMs(value) {
  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
}

export async function buildGroupAvailability({ groupId, windowStartMs, windowEndMs, granularityMinutes }) {
  const startMs = toEpochMs(windowStartMs);
  const endMs = toEpochMs(windowEndMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('windowStartMs and windowEndMs are required (epoch ms).');
  }

  const members = await listGroupMembers(groupId);
  const events = await getEventsForGroupOverlappingWindow(groupId, new Date(startMs), new Date(endMs));

  const eventsByUser = new Map();
  for (const ev of events) {
    const list = eventsByUser.get(ev.userId) || [];
    list.push({ startMs: ev.startMs, endMs: ev.endMs, priority: ev.priority });
    eventsByUser.set(ev.userId, list);
  }

  const participants = members.map((m) => ({
    userId: String(m.user_id),
    events: eventsByUser.get(m.user_id) || [],
  }));

  const blocks = computeAvailabilityBlocks({
    windowStartMs: startMs,
    windowEndMs: endMs,
    participants,
    granularityMinutes,
  });

  return { blocks, memberCount: members.length };
}
