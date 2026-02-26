import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../api.js', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

jest.mock('../../components/Calendar/CustomCalendar', () => function MockCalendar() {
  return <div data-testid="calendar">CALENDAR</div>;
});

jest.mock('../../components/Groups/Groups', () => function MockGroups({ refreshSignal }) {
  return <div data-testid="groups">GROUPS {refreshSignal}</div>;
});

jest.mock('../../components/Calendar/EventSidebar', () => function MockEventSidebar() {
  return <div data-testid="event-sidebar">EVENT_SIDEBAR</div>;
});

jest.mock('../../components/Groups/PendingInviteModal', () => function MockPendingInviteModal({
  invite,
  loading,
  error,
  onAccept,
  onDecline
}) {
  if (!invite) return null;
  return (
    <div data-testid="pending-invite-modal">
      <p>{invite.groupName}</p>
      {error ? <p>{error}</p> : null}
      <button onClick={onDecline} disabled={loading}>Decline</button>
      <button onClick={onAccept} disabled={loading}>Accept</button>
    </div>
  );
});

const { apiGet, apiPost } = require('../../api.js');
const Main = require('../../Main.jsx').default;

function setupApiGetWithPendingInvite(invite) {
  apiGet.mockImplementation(async (path) => {
    if (path === '/api/events') return [];
    if (path === '/user/groups') return { success: true, groups: [{ group_id: 1, group_name: 'G1' }] };
    if (path === '/api/group-invite/pending') {
      return invite
        ? { ok: true, hasPendingInvite: true, invite }
        : { ok: true, hasPendingInvite: false };
    }
    return {};
  });
}

describe('Main pending invite flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches pending invite on mount and renders modal when invite exists', async () => {
    setupApiGetWithPendingInvite({ groupId: '7', groupName: 'Team Alpha', expiresAtMs: 1700000000000 });

    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-invite-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
  });

  test('accept decision posts response and refreshes groups list', async () => {
    setupApiGetWithPendingInvite({ groupId: '7', groupName: 'Team Alpha', expiresAtMs: 1700000000000 });
    apiPost.mockResolvedValue({ ok: true });

    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-invite-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Accept'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/group-invite/respond', { decision: 'accept' });
    });

    await waitFor(() => {
      const groupCalls = apiGet.mock.calls.filter(([path]) => path === '/user/groups');
      expect(groupCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('decline decision clears pending invite modal', async () => {
    setupApiGetWithPendingInvite({ groupId: '7', groupName: 'Team Alpha', expiresAtMs: 1700000000000 });
    apiPost.mockResolvedValue({ ok: true });

    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('pending-invite-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Decline'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/group-invite/respond', { decision: 'decline' });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('pending-invite-modal')).not.toBeInTheDocument();
    });
  });
});
