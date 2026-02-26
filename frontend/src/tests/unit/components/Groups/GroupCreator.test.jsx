import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../../../api.js', () => ({
  apiPost: jest.fn(),
  apiPostWithMeta: jest.fn()
}));

const { apiPost, apiPostWithMeta } = require('../../../../api.js');
const GroupCreator = require('../../../../components/Groups/GroupCreator.jsx').default;

describe('GroupCreator modal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows validation error for empty group name', async () => {
    render(<GroupCreator onClose={() => {}} onGroupCreated={() => {}} onDone={() => {}} />);

    fireEvent.click(screen.getByText('Create Group!'));

    expect(await screen.findByText('Please enter a group name.')).toBeInTheDocument();
    expect(apiPostWithMeta).not.toHaveBeenCalled();
  });

  test('successful create shows invite section and calls onGroupCreated', async () => {
    const onGroupCreated = jest.fn();
    apiPostWithMeta.mockResolvedValue({
      status: 201,
      data: { success: true, groupId: '12' }
    });
    apiPost.mockResolvedValue({ invite: 'http://localhost:8080/group/respond-invitation?q=test' });

    render(<GroupCreator onClose={() => {}} onGroupCreated={onGroupCreated} onDone={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Enter group name...'), {
      target: { value: 'My Group' }
    });
    fireEvent.click(screen.getByText('Create Group!'));

    await waitFor(() => {
      expect(apiPostWithMeta).toHaveBeenCalled();
    });
    expect(onGroupCreated).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Group Created!')).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://localhost:8080/group/respond-invitation?q=test')).toBeInTheDocument();
  });

  test('invite generation failure shows invite error', async () => {
    apiPostWithMeta.mockResolvedValue({
      status: 201,
      data: { success: true, groupId: '12' }
    });
    apiPost.mockRejectedValue(new Error('invite failed'));

    render(<GroupCreator onClose={() => {}} onGroupCreated={() => {}} onDone={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Enter group name...'), {
      target: { value: 'My Group' }
    });
    fireEvent.click(screen.getByText('Create Group!'));

    expect(await screen.findByText('Group created, but invite link generation failed.')).toBeInTheDocument();
  });

  test('done button calls onDone after successful creation', async () => {
    const onDone = jest.fn();
    apiPostWithMeta.mockResolvedValue({
      status: 201,
      data: { success: true, groupId: '12' }
    });
    apiPost.mockResolvedValue({ invite: 'http://localhost:8080/group/respond-invitation?q=test' });

    render(<GroupCreator onClose={() => {}} onGroupCreated={() => {}} onDone={onDone} />);

    fireEvent.change(screen.getByPlaceholderText('Enter group name...'), {
      target: { value: 'My Group' }
    });
    fireEvent.click(screen.getByText('Create Group!'));

    await screen.findByText('Group Created!');
    fireEvent.click(screen.getByText('Done'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
