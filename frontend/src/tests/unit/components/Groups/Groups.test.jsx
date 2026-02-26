import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../../../api.js', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn()
}));

jest.mock('../../../../components/Groups/GroupCreator.jsx', () => function MockGroupCreator(props) {
  return (
    <div data-testid="group-creator-modal">
      <button onClick={() => props.onGroupCreated && props.onGroupCreated()}>trigger-group-created</button>
      <button onClick={() => props.onDone && props.onDone()}>trigger-done</button>
    </div>
  );
});

jest.mock('../../../../components/Groups/GroupInfo.jsx', () => function MockGroupInfo(props) {
  return (
    <div data-testid="group-info-modal">
      <p>{props.groupName}</p>
      <button onClick={props.onClose}>close-info</button>
    </div>
  );
});

const { apiGet, apiPost } = require('../../../../api.js');
const Groups = require('../../../../components/Groups/Groups.jsx').default;

describe('Groups component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiGet.mockResolvedValue({
      success: true,
      groups: [
        { group_id: 1, group_name: 'Alpha' },
        { group_id: 2, group_name: 'Beta' }
      ]
    });
    apiPost.mockResolvedValue({ success: true });
  });

  test('fetches and displays groups on mount', async () => {
    render(<Groups onSelectGroup={() => {}} onOpenPetition={() => {}} refreshSignal={0} />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/user/groups');
    });
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(await screen.findByText('Beta')).toBeInTheDocument();
  });

  test('view button toggles active group and calls onSelectGroup', async () => {
    const onSelectGroup = jest.fn();
    render(<Groups onSelectGroup={onSelectGroup} onOpenPetition={() => {}} refreshSignal={0} />);

    await screen.findByText('Alpha');

    fireEvent.click(screen.getAllByText('View')[0]);
    expect(onSelectGroup).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('Hide'));
    expect(onSelectGroup).toHaveBeenCalledWith(null);
  });

  test('leave removes active selection and posts leave request', async () => {
    const onSelectGroup = jest.fn();
    render(<Groups onSelectGroup={onSelectGroup} onOpenPetition={() => {}} refreshSignal={0} />);

    await screen.findByText('Alpha');

    fireEvent.click(screen.getAllByText('View')[0]);
    fireEvent.click(screen.getAllByText('Leave')[0]);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/group/leave', { groupId: 1 });
    });
    expect(onSelectGroup).toHaveBeenCalledWith(1);
  });

  test('opens group creator modal and refreshes on create callback', async () => {
    render(<Groups onSelectGroup={() => {}} onOpenPetition={() => {}} refreshSignal={0} />);

    await screen.findByText('Alpha');
    fireEvent.click(screen.getByText('+ Create New Group'));

    expect(screen.getByTestId('group-creator-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('trigger-group-created'));

    await waitFor(() => {
      const calls = apiGet.mock.calls.filter(([path]) => path === '/user/groups');
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
