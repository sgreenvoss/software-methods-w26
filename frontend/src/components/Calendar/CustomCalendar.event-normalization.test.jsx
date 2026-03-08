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

function getCurrentWeekDate(dayOffset = 0, hour = 0, minute = 0) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  return start;
}

function toDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUtcMidnightIso(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
}

function buildAllDayEvent({ title, startDayOffset, daySpan }) {
  const startDate = getCurrentWeekDate(startDayOffset);
  const endDate = getCurrentWeekDate(startDayOffset + daySpan);
  return {
    title,
    start: toUtcMidnightIso(startDate),
    end: toUtcMidnightIso(endDate),
    event_id: `${title}-id`,
    isAllDay: true,
    allDayStartDate: toDateOnly(startDate),
    allDayEndDate: toDateOnly(endDate)
  };
}

function buildTimedEvent({ title, startDayOffset, startHour, endDayOffset, endHour }) {
  return {
    title,
    start: getCurrentWeekDate(startDayOffset, startHour).toISOString(),
    end: getCurrentWeekDate(endDayOffset, endHour).toISOString(),
    event_id: `${title}-id`
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

function getCalendarCell(container, dayIndex, hour) {
  return container.querySelectorAll('.calendar-cell')[(hour * 7) + dayIndex];
}

function findEventInCell(cell, title) {
  if (!cell) return null;
  return Array.from(cell.querySelectorAll('.calendar-event')).find(
    (node) => node.textContent && node.textContent.trim() === title
  ) || null;
}

function findEventsByTitle(container, title) {
  return Array.from(container.querySelectorAll('.calendar-event')).filter(
    (node) => node.textContent && node.textContent.trim() === title
  );
}

describe('CustomCalendar event normalization', () => {
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

  test('renders all-day events on the correct day instead of the previous-day 4pm slot', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          buildAllDayEvent({
            title: 'All Day Regression',
            startDayOffset: 2,
            daySpan: 1
          })
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar draftEvent={null} />);
    });
    await flushMultiple();

    expect(findEventInCell(getCalendarCell(container, 2, 0), 'All Day Regression')).not.toBeNull();
    expect(findEventInCell(getCalendarCell(container, 1, 16), 'All Day Regression')).toBeNull();
  });

  test('splits a multi-day all-day event into one rendered segment per day', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          buildAllDayEvent({
            title: 'Weekend Trip',
            startDayOffset: 3,
            daySpan: 3
          })
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar draftEvent={null} />);
    });
    await flushMultiple();

    expect(findEventsByTitle(container, 'Weekend Trip')).toHaveLength(3);
    expect(findEventInCell(getCalendarCell(container, 3, 0), 'Weekend Trip')).not.toBeNull();
    expect(findEventInCell(getCalendarCell(container, 4, 0), 'Weekend Trip')).not.toBeNull();
    expect(findEventInCell(getCalendarCell(container, 5, 0), 'Weekend Trip')).not.toBeNull();
  });

  test('renders full-day events at lower opacity than standard same-day events', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          buildTimedEvent({
            title: 'Standard Meeting',
            startDayOffset: 2,
            startHour: 9,
            endDayOffset: 2,
            endHour: 10
          }),
          buildAllDayEvent({
            title: 'Conference Day',
            startDayOffset: 3,
            daySpan: 1
          })
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar draftEvent={null} />);
    });
    await flushMultiple();

    const standardEvent = findEventsByTitle(container, 'Standard Meeting')[0];
    const allDayEvent = findEventsByTitle(container, 'Conference Day')[0];

    expect(parseFloat(standardEvent.style.opacity || '1')).toBeCloseTo(1, 3);
    expect(parseFloat(allDayEvent.style.opacity)).toBeCloseTo(0.5, 3);
  });

  test('keeps timed overnight events split across both days', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          buildTimedEvent({
            title: 'Overnight Shift',
            startDayOffset: 4,
            startHour: 22,
            endDayOffset: 5,
            endHour: 2
          })
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar draftEvent={null} />);
    });
    await flushMultiple();

    expect(findEventsByTitle(container, 'Overnight Shift')).toHaveLength(2);
    expect(findEventInCell(getCalendarCell(container, 4, 22), 'Overnight Shift')).not.toBeNull();
    expect(findEventInCell(getCalendarCell(container, 5, 0), 'Overnight Shift')).not.toBeNull();
  });

  test('renders multi-day timed segments at lower opacity than standard same-day events', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/get-events') {
        return [
          buildTimedEvent({
            title: 'Lunch',
            startDayOffset: 1,
            startHour: 12,
            endDayOffset: 1,
            endHour: 13
          }),
          buildTimedEvent({
            title: 'Late Deployment',
            startDayOffset: 4,
            startHour: 22,
            endDayOffset: 5,
            endHour: 2
          })
        ];
      }
      if (path === '/api/me') return { user: { user_id: 100 } };
      if (path === '/api/petitions') return [];
      return [];
    });

    await act(async () => {
      root.render(<CustomCalendar draftEvent={null} />);
    });
    await flushMultiple();

    const sameDayEvent = findEventsByTitle(container, 'Lunch')[0];
    const overnightSegments = findEventsByTitle(container, 'Late Deployment');

    expect(parseFloat(sameDayEvent.style.opacity || '1')).toBeCloseTo(1, 3);
    expect(overnightSegments).toHaveLength(2);
    overnightSegments.forEach((segment) => {
      expect(parseFloat(segment.style.opacity)).toBeCloseTo(0.5, 3);
    });
  });
});
