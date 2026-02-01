import { computeAvailabilityBlocks } from '../../../algorithm/algorithm.js';
import { getCachedEvents } from './calendarCache.service.js';

export async function buildAvailability({ windowStartMs, windowEndMs, granularityMinutes }) {
  const { events, meta } = await getCachedEvents({ windowStartMs, windowEndMs });

  const participants = [
    {
      userId: 'me',
      events,
    },
  ];

  const blocks = computeAvailabilityBlocks({
    windowStartMs,
    windowEndMs,
    participants,
    granularityMinutes,
  });

  return { blocks, meta };
}
