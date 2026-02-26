import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../api.js', () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn()
}));

const { apiPost } = require('../../api.js');
const UsernameCreation = require('../../UsernameCreation.jsx').default;

describe('UsernameCreation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('client-side validation blocks short usernames', async () => {
    render(<UsernameCreation />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(await screen.findByText('Username must be between 4-16 characters')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  test('shows API validation errors when server rejects username', async () => {
    apiPost.mockResolvedValue({ success: false, errors: ['Username already taken'] });

    render(<UsernameCreation />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'David_123' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(await screen.findByText('Username already taken')).toBeInTheDocument();
  });

  test('shows generic error on request failure', async () => {
    apiPost.mockRejectedValue(new Error('network issue'));

    render(<UsernameCreation />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Valid_Name' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(await screen.findByText('An error occurred.')).toBeInTheDocument();
  });

  test('successful username creation submits payload', async () => {
    apiPost.mockResolvedValue({ success: true });

    render(<UsernameCreation />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Valid_Name' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/create-username', { username: 'Valid_Name' });
    });
  });
});
