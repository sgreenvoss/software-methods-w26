import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import Main from './Main';
import { apiGet, apiPost } from './api';

jest.mock('./api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

jest.mock('./components/Groups/PendingInviteModal', () => function PendingInviteModalMock() {
  return null;
});

jest.mock('./components/Calendar/EventSidebar', () => function EventSidebarMock({ petitionGroupId }) {
  return (
    <div data-testid="event-sidebar">
      <div data-testid="event-sidebar-petition-group-id">{petitionGroupId == null || petitionGroupId === '' ? 'none' : String(petitionGroupId)}</div>
    </div>
  );
});

jest.mock('./components/Calendar/CustomCalendar', () => function CalendarMock({ groupId }) {
  return <div data-testid="calendar-group-id">{groupId == null ? 'none' : String(groupId)}</div>;
});

jest.mock('./components/Groups/Groups', () => function GroupsMock({ selectedGroupId, onSelectGroup, onOpenPetition }) {
  return (
    <div>
      <div data-testid="groups-selected-group-id">{selectedGroupId == null ? 'none' : String(selectedGroupId)}</div>
      <button type="button" onClick={() => onSelectGroup(7)}>Select Group 7</button>
      <button type="button" onClick={() => onSelectGroup(null)}>Hide Selected Group</button>
      <button type="button" onClick={() => onOpenPetition(9)}>Petition Group 9</button>
    </div>
  );
});

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function findButton(container, label) {
  const buttons = Array.from(container.querySelectorAll('button'));
  return buttons.find((button) => button.textContent && button.textContent.includes(label));
}

describe('Main availability selection state', () => {
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

    apiGet.mockImplementation(async (path) => {
      if (path === '/api/events') return [];
      if (path === '/user/groups') return { success: true, groups: [{ group_id: 7, group_name: 'Group 7' }] };
      if (path === '/api/group-invite/pending') return { ok: true, hasPendingInvite: false };
      return [];
    });
    apiPost.mockResolvedValue({ ok: true });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  test('keeps selected group availability visible across sidebar and panel toggles', async () => {
    await act(async () => {
      root.render(<Main />);
    });
    await flushEffects();

    await act(async () => {
      findButton(container, 'Show Groups').click();
    });

    await act(async () => {
      findButton(container, 'Select Group 7').click();
    });

    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('7');

    await act(async () => {
      findButton(container, 'Hide Groups').click();
    });
    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('7');

    await act(async () => {
      findButton(container, 'Show Groups').click();
    });
    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('7');

    await act(async () => {
      findButton(container, 'Add Event').click();
    });
    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('7');

    await act(async () => {
      findButton(container, 'Close Event').click();
    });
    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('7');
  });

  test('clears selected group only on explicit hide action', async () => {
    await act(async () => {
      root.render(<Main />);
    });
    await flushEffects();

    await act(async () => {
      findButton(container, 'Show Groups').click();
    });

    await act(async () => {
      findButton(container, 'Select Group 7').click();
    });
    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('7');

    await act(async () => {
      findButton(container, 'Hide Selected Group').click();
    });
    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('none');
  });

  test('petitioning a group syncs petition target and active calendar group', async () => {
    await act(async () => {
      root.render(<Main />);
    });
    await flushEffects();

    await act(async () => {
      findButton(container, 'Show Groups').click();
    });

    await act(async () => {
      findButton(container, 'Petition Group 9').click();
    });

    expect(container.querySelector('[data-testid="calendar-group-id"]').textContent).toBe('9');
    expect(container.querySelector('[data-testid="event-sidebar-petition-group-id"]').textContent).toBe('9');
  });
});
