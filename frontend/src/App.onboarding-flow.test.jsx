import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import App from './App';
import { apiGet } from './api';

jest.mock('./api', () => ({
  apiGet: jest.fn()
}));

jest.mock('./Login.jsx', () => function LoginMock() {
  return <div data-testid="login-screen">Login</div>;
});

jest.mock('./Main.jsx', () => function MainMock() {
  return <div data-testid="main-screen">Main</div>;
});

jest.mock('./UsernameCreation.jsx', () => function UsernameCreationMock() {
  return <div data-testid="username-screen">UsernameCreation</div>;
});

jest.mock('./components/Groups/InviteHandler.jsx', () => function InviteHandlerMock() {
  return null;
});

describe('App onboarding gating', () => {
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
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
  });

  test('routes new users to username creation flow', async () => {
    apiGet.mockResolvedValue({ user: { username: 'New user!' } });

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('[data-testid="username-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="main-screen"]')).toBeNull();
  });

  test('routes existing users to main app', async () => {
    apiGet.mockResolvedValue({ user: { username: 'alice' } });

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('[data-testid="main-screen"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="username-screen"]')).toBeNull();
  });
});
