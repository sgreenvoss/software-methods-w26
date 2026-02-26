import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../api.js', () => ({
  apiGet: jest.fn()
}));

jest.mock('../../Login.jsx', () => function MockLogin() {
  return <div>LOGIN_VIEW</div>;
});

jest.mock('../../Main.jsx', () => function MockMain() {
  return <div>MAIN_VIEW</div>;
});

jest.mock('../../UsernameCreation.jsx', () => function MockUsernameCreation() {
  return <div>USERNAME_CREATION_VIEW</div>;
});

jest.mock('../../components/Groups/InviteHandler.jsx', () => function MockInviteHandler() {
  return null;
});

const { apiGet } = require('../../api.js');
const App = require('../../App.jsx').default;

describe('App auth routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows login when /api/me returns null user', async () => {
    apiGet.mockResolvedValueOnce({ user: null });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('LOGIN_VIEW')).toBeInTheDocument();
    });
  });

  test('shows username creation for New user! sentinel', async () => {
    apiGet.mockResolvedValueOnce({
      user: { user_id: '1', username: 'New user!' }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('USERNAME_CREATION_VIEW')).toBeInTheDocument();
    });
  });

  test('shows main app for authenticated user with username', async () => {
    apiGet.mockResolvedValueOnce({
      user: { user_id: '1', username: 'David' }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('MAIN_VIEW')).toBeInTheDocument();
    });
  });
});
