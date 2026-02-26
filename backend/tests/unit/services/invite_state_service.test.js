const { createInviteStateService } = require('../../../services/invite_state_service.js');

function createReq({
  sessionToken,
  signedToken,
  userId,
  isAuthenticated
} = {}) {
  return {
    session: {
      userId,
      isAuthenticated,
      pendingGroupToken: sessionToken,
      save: jest.fn((cb) => cb())
    },
    signedCookies: signedToken
      ? { pending_group_invite: signedToken }
      : {}
  };
}

function createRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn()
  };
}

describe('invite_state_service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('setPendingInvite writes session + signed cookie', async () => {
    const inviteState = createInviteStateService({ isProduction: false });
    const req = createReq();
    const res = createRes();

    await inviteState.setPendingInvite(req, res, 'tok-123');

    expect(req.session.pendingGroupToken).toBe('tok-123');
    expect(res.cookie).toHaveBeenCalledWith(
      'pending_group_invite',
      'tok-123',
      expect.objectContaining({
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000
      })
    );
    expect(req.session.save).toHaveBeenCalledTimes(1);
  });

  test('getPendingInviteToken prefers session token', async () => {
    const inviteState = createInviteStateService();
    const req = createReq({ sessionToken: 'session-token', signedToken: 'cookie-token' });

    const token = await inviteState.getPendingInviteToken(req);

    expect(token).toBe('session-token');
    expect(req.session.save).not.toHaveBeenCalled();
  });

  test('getPendingInviteToken falls back to signed cookie and rehydrates session', async () => {
    const inviteState = createInviteStateService();
    const req = createReq({ signedToken: 'cookie-token' });

    const token = await inviteState.getPendingInviteToken(req);

    expect(token).toBe('cookie-token');
    expect(req.session.pendingGroupToken).toBe('cookie-token');
    expect(req.session.save).toHaveBeenCalledTimes(1);
  });

  test('clearPendingInvite clears session token and cookie', async () => {
    const inviteState = createInviteStateService();
    const req = createReq({ sessionToken: 'session-token' });
    const res = createRes();

    await inviteState.clearPendingInvite(req, res);

    expect(req.session.pendingGroupToken).toBeUndefined();
    expect(res.clearCookie).toHaveBeenCalledWith(
      'pending_group_invite',
      expect.objectContaining({
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      })
    );
    expect(req.session.save).toHaveBeenCalledTimes(1);
  });

  test('isAuthenticated returns true only when session auth flags are present', () => {
    const inviteState = createInviteStateService();

    expect(inviteState.isAuthenticated(createReq({ userId: '1', isAuthenticated: true }))).toBe(true);
    expect(inviteState.isAuthenticated(createReq({ userId: '1', isAuthenticated: false }))).toBe(false);
    expect(inviteState.isAuthenticated(createReq({ userId: undefined, isAuthenticated: true }))).toBe(false);
  });
});
