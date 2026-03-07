import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import CustomCalendar from './CustomCalendar';
import { apiGet, apiPost } from '../../api';

jest.mock('../../api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

jest.mock('../Petitions/PetitionActionModal', () => function PetitionActionModalMock() {
  return null;
});

function buildAvailabilityResponse(groupTag) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(9, 0, 0, 0);
  const blockStart = startOfWeek;
  const blockEnd = new Date(blockStart.getTime() + (15 * 60 * 1000));

  if (groupTag === 'fallback') {
    return {
      ok: true,
      blocks: [
        {
          start: blockStart.toISOString(),
          end: blockEnd.toISOString(),
          count: 2,
          totalCount: 5
        }
      ]
    };
  }

  return {
    ok: true,
    blocks: [
      {
        start: blockStart.toISOString(),
        end: blockEnd.toISOString(),
        count: groupTag === 'g1' ? 4 : 3,
        views: {
          StrictView: { availableCount: groupTag === 'g1' ? 4 : 3, busyCount: 1, totalCount: 5, availabilityFraction: 0.8 },
          FlexibleView: { availableCount: groupTag === 'g1' ? 3 : 2, busyCount: 2, totalCount: 5, availabilityFraction: 0.6 },
          LenientView: { availableCount: groupTag === 'g1' ? 2 : 1, busyCount: 3, totalCount: 5, availabilityFraction: 0.4 }
        }
      }
    ]
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function flushMultiple(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await flushEffects();
  }
}

function countAvailabilityCalls() {
  return apiGet.mock.calls.filter(([path]) => typeof path === 'string' && path.includes('/availability?')).length;
}

function findButton(container, label) {
  const buttons = Array.from(container.querySelectorAll('button'));
  return buttons.find((button) => button.textContent && button.textContent.trim() === label);
}

function getCurrentWeekSlot() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + (30 * 60 * 1000));
  return { start: start.toISOString(), end: end.toISOString() };
}

function findCalendarEvent(container, title) {
  return Array.from(container.querySelectorAll('.calendar-event')).find(
    (node) => node.textContent && node.textContent.trim() === title
  );
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('CustomCalendar availability view switching', () => {
  let container;
  let root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    apiPost.mockResolvedValue({ ok: true });
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') return [];
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return buildAvailabilityResponse('g1');
      if (typeof path === 'string' && path.includes('/api/groups/2/availability?')) return buildAvailabilityResponse('g2');
      if (typeof path === 'string' && path === '/api/groups/1/petitions') return [];
      if (typeof path === 'string' && path === '/api/groups/2/petitions') return [];
      if (path === '/api/petitions') return [];
      return [];
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  test('mode toggle reprojects locally without refetching availability', async () => {
    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    const initialCalls = countAvailabilityCalls();
    expect(initialCalls).toBeGreaterThan(0);

    await act(async () => {
      findButton(container, 'Strict').click();
    });

    await act(async () => {
      findButton(container, 'Lenient').click();
    });

    expect(countAvailabilityCalls()).toBe(initialCalls);
  });

  test('restores per-group in-session mode selection and defaults first view to Flexible', async () => {
    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    expect(findButton(container, 'Flexible').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      findButton(container, 'Strict').click();
    });
    expect(findButton(container, 'Strict').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      root.render(<CustomCalendar groupId={2} draftEvent={null} />);
    });
    await flushMultiple();

    expect(findButton(container, 'Flexible').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    expect(findButton(container, 'Strict').getAttribute('aria-pressed')).toBe('true');
  });

  test('strict and lenient layering respect blocking levels', async () => {
    const slot = getCurrentWeekSlot();
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          { title: 'B1 Event', start: slot.start, end: slot.end, event_id: 'ev-b1', priority: 1 },
          { title: 'B3 Event', start: slot.start, end: slot.end, event_id: 'ev-b3', priority: 3 }
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return buildAvailabilityResponse('g1');
      if (path === '/api/groups/1/petitions') return [];
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    await act(async () => {
      findButton(container, 'Strict').click();
    });
    await flushMultiple(2);

    let b1Event = findCalendarEvent(container, 'B1 Event');
    let b3Event = findCalendarEvent(container, 'B3 Event');
    expect(Number(b1Event.style.zIndex)).toBe(4);
    expect(Number(b3Event.style.zIndex)).toBe(4);

    await act(async () => {
      findButton(container, 'Lenient').click();
    });
    await flushMultiple(2);

    b1Event = findCalendarEvent(container, 'B1 Event');
    b3Event = findCalendarEvent(container, 'B3 Event');
    expect(Number(b1Event.style.zIndex)).toBe(2);
    expect(Number(b3Event.style.zIndex)).toBe(4);
  });

  test('preserves event-provided background and text colors over fallback palette', async () => {
    const slot = getCurrentWeekSlot();
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          {
            title: 'Custom Color Event',
            start: slot.start,
            end: slot.end,
            event_id: 'ev-color',
            priority: 3,
            backgroundColor: 'rgb(10, 20, 30)',
            color: 'rgb(200, 210, 220)',
            borderColor: 'rgb(1, 2, 3)'
          }
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return buildAvailabilityResponse('g1');
      if (path === '/api/groups/1/petitions') return [];
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    const customEvent = findCalendarEvent(container, 'Custom Color Event');
    expect(customEvent).toBeDefined();
    expect(customEvent.style.backgroundColor).toBe('rgb(10, 20, 30)');
    expect(customEvent.style.color).toBe('rgb(200, 210, 220)');
    expect(customEvent.style.borderColor).toBe('rgb(1, 2, 3)');
  });

  test('strict-compatible payload without views falls back to StrictView', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') return [];
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return buildAvailabilityResponse('fallback');
      if (path === '/api/groups/1/petitions') return [];
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    expect(findButton(container, 'Strict').getAttribute('aria-pressed')).toBe('true');
    expect(findButton(container, 'Flexible').disabled).toBe(true);
    expect(findButton(container, 'Lenient').disabled).toBe(true);
    expect(container.querySelectorAll('.availability-legend-item').length).toBe(2);
  });

  test('stale availability response does not overwrite current group context', async () => {
    const delayedG1 = createDeferred();
    const delayedG2 = createDeferred();

    apiGet.mockImplementation((path) => {
      if (path === '/api/get-events') return Promise.resolve([]);
      if (path === '/api/me') return Promise.resolve({ user: { user_id: 100 } });
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return delayedG1.promise;
      if (typeof path === 'string' && path.includes('/api/groups/2/availability?')) return delayedG2.promise;
      if (path === '/api/groups/1/petitions') return Promise.resolve([]);
      if (path === '/api/groups/2/petitions') return Promise.resolve([]);
      if (path === '/api/petitions') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    await act(async () => {
      root.render(<CustomCalendar groupId={2} draftEvent={null} />);
    });
    await flushMultiple();

    await act(async () => {
      delayedG2.resolve({
        ok: true,
        blocks: [
          {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            count: 1,
            views: {
              StrictView: { availableCount: 1, busyCount: 4, totalCount: 5, availabilityFraction: 0.2 },
              FlexibleView: { availableCount: 1, busyCount: 4, totalCount: 5, availabilityFraction: 0.2 },
              LenientView: { availableCount: 1, busyCount: 4, totalCount: 5, availabilityFraction: 0.2 }
            }
          }
        ]
      });
      await Promise.resolve();
    });

    await act(async () => {
      delayedG1.resolve({
        ok: true,
        blocks: [
          {
            start: new Date().toISOString(),
            end: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            count: 4,
            views: {
              StrictView: { availableCount: 4, busyCount: 1, totalCount: 5, availabilityFraction: 0.8 },
              FlexibleView: { availableCount: 4, busyCount: 1, totalCount: 5, availabilityFraction: 0.8 },
              LenientView: { availableCount: 4, busyCount: 1, totalCount: 5, availabilityFraction: 0.8 }
            }
          }
        ]
      });
      await Promise.resolve();
    });

    await flushMultiple(4);
    expect(container.querySelectorAll('.availability-legend-item').length).toBe(1);
  });
});
