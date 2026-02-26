import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../../../api.js', () => ({
  apiGet: jest.fn()
}));

const { apiGet } = require('../../../../api.js');
const CustomCalendar = require('../../../../components/Calendar/CustomCalendar.jsx').default;

function getCurrentWeekSlot() {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const startMs = weekStart.getTime() + 60 * 60 * 1000;
  const endMs = startMs + 15 * 60 * 1000;
  return { startMs, endMs };
}

describe('CustomCalendar group availability rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders availability using response.availability primary field', async () => {
    const { startMs, endMs } = getCurrentWeekSlot();

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/events') return [];
      if (path.startsWith('/api/groups/9/availability')) {
        return {
          ok: true,
          availability: [{ start: startMs, end: endMs, count: 2 }]
        };
      }
      return {};
    });

    render(<CustomCalendar groupId={9} draftEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Avail: 2')).toBeInTheDocument();
    });
  });

  test('falls back to response.blocks when availability field is missing', async () => {
    const { startMs, endMs } = getCurrentWeekSlot();

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/events') return [];
      if (path.startsWith('/api/groups/9/availability')) {
        return {
          ok: true,
          blocks: [{ start: startMs, end: endMs, count: 3 }]
        };
      }
      return {};
    });

    render(<CustomCalendar groupId={9} draftEvent={null} />);

    await waitFor(() => {
      expect(screen.getByText('Avail: 3')).toBeInTheDocument();
    });
  });

  test('does not fetch group availability when no group is selected', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/events') return [];
      return {};
    });

    render(<CustomCalendar groupId={null} draftEvent={null} />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/events');
    });

    const groupAvailabilityCalls = apiGet.mock.calls.filter(([path]) => path.startsWith('/api/groups/'));
    expect(groupAvailabilityCalls).toHaveLength(0);
    expect(screen.queryByText(/Avail:/)).not.toBeInTheDocument();
  });
});
