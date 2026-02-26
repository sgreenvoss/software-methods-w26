import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PendingInviteModal from '../../../../components/Groups/PendingInviteModal.jsx';

describe('PendingInviteModal', () => {
  test('renders nothing when invite is null', () => {
    const { container } = render(
      <PendingInviteModal
        invite={null}
        loading={false}
        error=""
        onAccept={() => {}}
        onDecline={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test('renders group name and invokes button handlers', () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();

    render(
      <PendingInviteModal
        invite={{ groupName: 'Team Rocket' }}
        loading={false}
        error=""
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    expect(screen.getByText('Group Invitation')).toBeInTheDocument();
    expect(screen.getByText('Team Rocket')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Accept'));
    fireEvent.click(screen.getByText('Decline'));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  test('disables actions and shows loading text when loading=true', () => {
    render(
      <PendingInviteModal
        invite={{ groupName: 'Team Rocket' }}
        loading={true}
        error="Could not process"
        onAccept={() => {}}
        onDecline={() => {}}
      />
    );

    expect(screen.getByText('Working...')).toBeInTheDocument();
    expect(screen.getByText('Could not process')).toBeInTheDocument();
    expect(screen.getByText('Decline')).toBeDisabled();
    expect(screen.getByText('Working...')).toBeDisabled();
  });
});
