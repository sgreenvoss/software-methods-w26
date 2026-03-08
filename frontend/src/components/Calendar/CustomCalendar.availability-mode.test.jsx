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

function getCurrentWeekDate(hour = 9, minute = 0) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(hour, minute, 0, 0);
  return start;
}

function buildAvailabilityResponse(groupTag) {
  const blockStart = getCurrentWeekDate(9, 0);
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

  if (groupTag === 'contrast') {
    const secondBlockStart = getCurrentWeekDate(10, 0);
    const secondBlockEnd = new Date(secondBlockStart.getTime() + (15 * 60 * 1000));

    return {
      ok: true,
      blocks: [
        {
          start: blockStart.toISOString(),
          end: blockEnd.toISOString(),
          count: 2,
          views: {
            StrictView: { availableCount: 2, busyCount: 3, totalCount: 5, availabilityFraction: 0.4 },
            FlexibleView: { availableCount: 2, busyCount: 3, totalCount: 5, availabilityFraction: 0.4 },
            LenientView: { availableCount: 2, busyCount: 3, totalCount: 5, availabilityFraction: 0.4 }
          }
        },
        {
          start: secondBlockStart.toISOString(),
          end: secondBlockEnd.toISOString(),
          count: 4,
          views: {
            StrictView: { availableCount: 4, busyCount: 1, totalCount: 5, availabilityFraction: 0.8 },
            FlexibleView: { availableCount: 3, busyCount: 2, totalCount: 5, availabilityFraction: 0.6 },
            LenientView: { availableCount: 2, busyCount: 3, totalCount: 5, availabilityFraction: 0.4 }
          }
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
  const start = getCurrentWeekDate(9, 0);
  const end = new Date(start.getTime() + (30 * 60 * 1000));
  return { start: start.toISOString(), end: end.toISOString() };
}

function findCalendarEvent(container, title) {
  return Array.from(container.querySelectorAll('.calendar-event')).find(
    (node) => node.textContent && node.textContent.trim() === title
  );
}

function buildPetitionEvent({ title, hour, acceptedCount, declinedCount, groupSize, status }) {
  const start = getCurrentWeekDate(hour, 0);
  const end = new Date(start.getTime() + (30 * 60 * 1000));

  return {
    petition_id: `${title}-petition`,
    group_id: 1,
    title,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    accepted_count: acceptedCount,
    declined_count: declinedCount,
    group_size: groupSize,
    status,
    current_user_response: acceptedCount > 0 ? 'ACCEPTED' : null
  };
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

function expectedAvailabilityColor(availableCount, maxVisibleCount) {
  if (availableCount <= 0) {
    return 'transparent';
  }
  if (maxVisibleCount <= 1) {
    return 'hsl(145, 78%, 42%)';
  }

  const t = (availableCount - 1) / (maxVisibleCount - 1);
  const saturation = 60 + (18 * t);
  const lightness = 84 - (42 * t);
  return `hsl(145, ${saturation}%, ${lightness}%)`;
}

function expectedAvailabilityOpacity(availableCount, maxVisibleCount) {
  if (availableCount <= 0) {
    return 0;
  }
  if (maxVisibleCount <= 1) {
    return 0.82;
  }

  const t = (availableCount - 1) / (maxVisibleCount - 1);
  return 0.35 + (0.47 * t);
}

function normalizeCssColor(cssColor) {
  const swatch = document.createElement('div');
  swatch.style.backgroundColor = cssColor;
  return swatch.style.backgroundColor;
}

function findAvailabilityBlock(container, count) {
  return Array.from(container.querySelectorAll('.calendar-event[data-event-mode="avail"]')).find(
    (node) => node.getAttribute('data-availability-count') === String(count)
  );
}

function findLegendSwatch(container, count) {
  const legendItem = Array.from(container.querySelectorAll('.availability-legend-item')).find((node) => {
    const label = node.querySelector('.availability-legend-count');
    return label && label.textContent && label.textContent.trim() === String(count);
  });

  return legendItem ? legendItem.querySelector('.availability-legend-swatch') : null;
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

  test('mode toggle reprojects colors locally without refetching availability', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') return [];
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return buildAvailabilityResponse('contrast');
      if (typeof path === 'string' && path === '/api/groups/1/petitions') return [];
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    const initialCalls = countAvailabilityCalls();
    expect(initialCalls).toBeGreaterThan(0);
    expect(findAvailabilityBlock(container, 2).style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 3))
    );
    expect(parseFloat(findAvailabilityBlock(container, 2).style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 3),
      3
    );
    expect(findLegendSwatch(container, 2).style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 3))
    );
    expect(parseFloat(findLegendSwatch(container, 2).style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 3),
      3
    );

    await act(async () => {
      findButton(container, 'Strict').click();
    });
    await flushMultiple(2);

    expect(findAvailabilityBlock(container, 2).style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 4))
    );
    expect(parseFloat(findAvailabilityBlock(container, 2).style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 4),
      3
    );
    expect(findLegendSwatch(container, 2).style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 4))
    );
    expect(parseFloat(findLegendSwatch(container, 2).style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 4),
      3
    );

    await act(async () => {
      findButton(container, 'Lenient').click();
    });
    await flushMultiple(2);

    expect(findAvailabilityBlock(container, 2).style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 2))
    );
    expect(parseFloat(findAvailabilityBlock(container, 2).style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 2),
      3
    );
    expect(findLegendSwatch(container, 2).style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 2))
    );
    expect(parseFloat(findLegendSwatch(container, 2).style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 2),
      3
    );

    expect(countAvailabilityCalls()).toBe(initialCalls);
  });

  test('higher availability counts render with higher opacity in both blocks and legend', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') return [];
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return buildAvailabilityResponse('contrast');
      if (typeof path === 'string' && path === '/api/groups/1/petitions') return [];
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    const lowerBlock = findAvailabilityBlock(container, 2);
    const higherBlock = findAvailabilityBlock(container, 3);
    const lowerSwatch = findLegendSwatch(container, 2);
    const higherSwatch = findLegendSwatch(container, 3);

    expect(parseFloat(higherBlock.style.opacity)).toBeGreaterThan(parseFloat(lowerBlock.style.opacity));
    expect(parseFloat(higherSwatch.style.opacity)).toBeGreaterThan(parseFloat(lowerSwatch.style.opacity));
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

  test('renders petition statuses with distinct colors and only accepted-all uses white text', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') return [];
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (typeof path === 'string' && path.includes('/api/groups/1/availability?')) return { ok: true, blocks: [] };
      if (path === '/api/groups/1/petitions') {
        return [
          buildPetitionEvent({
            title: 'Open Petition',
            hour: 9,
            acceptedCount: 1,
            declinedCount: 0,
            groupSize: 4,
            status: 'OPEN'
          }),
          buildPetitionEvent({
            title: 'Declined Petition',
            hour: 10,
            acceptedCount: 1,
            declinedCount: 1,
            groupSize: 4,
            status: 'FAILED'
          }),
          buildPetitionEvent({
            title: 'Accepted Petition',
            hour: 11,
            acceptedCount: 4,
            declinedCount: 0,
            groupSize: 4,
            status: 'ACCEPTED_ALL'
          })
        ];
      }
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    const openPetition = findCalendarEvent(container, 'Open Petition');
    const declinedPetition = findCalendarEvent(container, 'Declined Petition');
    const acceptedPetition = findCalendarEvent(container, 'Accepted Petition');

    expect(openPetition.style.backgroundColor).toBe('rgb(244, 211, 94)');
    expect(openPetition.style.color).toBe('rgb(31, 31, 31)');

    expect(declinedPetition.style.backgroundColor).toBe('rgb(158, 163, 168)');
    expect(declinedPetition.style.color).toBe('rgb(31, 31, 31)');

    expect(acceptedPetition.style.backgroundColor).toBe('rgb(82, 183, 136)');
    expect(acceptedPetition.style.color).toBe('rgb(255, 255, 255)');
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

    const fallbackBlock = findAvailabilityBlock(container, 2);
    const fallbackSwatch = findLegendSwatch(container, 2);
    expect(fallbackBlock).toBeDefined();
    expect(fallbackSwatch).not.toBeNull();
    expect(fallbackBlock.style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 2))
    );
    expect(parseFloat(fallbackBlock.style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 2),
      3
    );
    expect(fallbackSwatch.style.backgroundColor).toBe(
      normalizeCssColor(expectedAvailabilityColor(2, 2))
    );
    expect(parseFloat(fallbackSwatch.style.opacity)).toBeCloseTo(
      expectedAvailabilityOpacity(2, 2),
      3
    );

    await act(async () => {
      fallbackBlock.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true,
        clientX: 30,
        clientY: 40
      }));
    });

    const fallbackTooltip = document.body.querySelector('[data-testid="availability-tooltip"]');
    expect(fallbackTooltip).not.toBeNull();
    expect(fallbackTooltip.textContent).toBe('2 people available');
  });

  test('shows and repositions count tooltip for availability hover', async () => {
    await act(async () => {
      root.render(<CustomCalendar groupId={1} draftEvent={null} />);
    });
    await flushMultiple();

    const availabilityBlock = findAvailabilityBlock(container, 3);
    expect(availabilityBlock).toBeDefined();

    await act(async () => {
      availabilityBlock.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true,
        clientX: 100,
        clientY: 200
      }));
    });

    let tooltip = document.body.querySelector('[data-testid="availability-tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toBe('3 people available');
    expect(tooltip.style.left).toBe('112px');
    expect(tooltip.style.top).toBe('210px');

    await act(async () => {
      availabilityBlock.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        clientX: 140,
        clientY: 240
      }));
    });

    tooltip = document.body.querySelector('[data-testid="availability-tooltip"]');
    expect(tooltip.style.left).toBe('152px');
    expect(tooltip.style.top).toBe('250px');

    await act(async () => {
      availabilityBlock.dispatchEvent(new MouseEvent('mouseout', {
        bubbles: true,
        clientX: 140,
        clientY: 240
      }));
    });

    expect(document.body.querySelector('[data-testid="availability-tooltip"]')).toBeNull();
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
