const express = require('express');
const request = require('supertest');
const registerInviteRoutes = require('../../../routes/invite_routes.js');

function createApp({ db, inviteToken, inviteState, session = {}, signedCookies = {} }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { ...session };
    req.signedCookies = { ...signedCookies };
    next();
  });
  registerInviteRoutes(app, { db, inviteToken, inviteState });
  return app;
}

function createDeps() {
  return {
    db: {
      isUserInGroup: jest.fn().mockResolvedValue(false),
      addUserToGroup: jest.fn().mockResolvedValue(),
      getGroupById: jest.fn().mockResolvedValue({ group_id: '7', group_name: 'Team Alpha' }),
      getGroupByID: jest.fn().mockResolvedValue([{ group_id: '7', group_name: 'Team Alpha' }])
    },
    inviteToken: {
      verifyInviteToken: jest.fn(),
      createInviteToken: jest.fn().mockReturnValue('signed-token')
    },
    inviteState: {
      isAuthenticated: jest.fn(),
      setPendingInvite: jest.fn().mockResolvedValue(),
      getPendingInviteToken: jest.fn().mockResolvedValue(null),
      clearPendingInvite: jest.fn().mockResolvedValue()
    }
  };
}

describe('invite routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /group/respond-invitation rejects invalid token', async () => {
    const deps = createDeps();
    deps.inviteToken.verifyInviteToken.mockReturnValue({ valid: false });

    const app = createApp({ ...deps });
    const res = await request(app).get('/group/respond-invitation?q=bad-token');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Bad invite token' });
  });

  test('GET /group/respond-invitation redirects unauthenticated users to /login', async () => {
    const deps = createDeps();
    deps.inviteToken.verifyInviteToken.mockReturnValue({ valid: true, groupId: '7', expiresAtMs: Date.now() + 1000 });
    deps.inviteState.isAuthenticated.mockReturnValue(false);

    const app = createApp({ ...deps });
    const res = await request(app).get('/group/respond-invitation?q=ok-token');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
    expect(deps.inviteState.setPendingInvite).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'ok-token');
  });

  test('GET /group/respond-invitation redirects authenticated users to /', async () => {
    const deps = createDeps();
    deps.inviteToken.verifyInviteToken.mockReturnValue({ valid: true, groupId: '7', expiresAtMs: Date.now() + 1000 });
    deps.inviteState.isAuthenticated.mockReturnValue(true);

    const app = createApp({ ...deps });
    const res = await request(app).get('/group/respond-invitation?q=ok-token');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  test('GET /api/group-invite/pending returns 401 when unauthorized', async () => {
    const deps = createDeps();
    deps.inviteState.isAuthenticated.mockReturnValue(false);

    const app = createApp({ ...deps });
    const res = await request(app).get('/api/group-invite/pending');

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  test('GET /api/group-invite/pending returns invite payload for valid token', async () => {
    const deps = createDeps();
    deps.inviteState.isAuthenticated.mockReturnValue(true);
    deps.inviteState.getPendingInviteToken.mockResolvedValue('pending-token');
    deps.inviteToken.verifyInviteToken.mockReturnValue({
      valid: true,
      groupId: '7',
      expiresAtMs: 1700000000000
    });

    const app = createApp({ ...deps, session: { userId: '11', isAuthenticated: true } });
    const res = await request(app).get('/api/group-invite/pending');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      hasPendingInvite: true,
      invite: {
        groupId: '7',
        groupName: 'Team Alpha',
        expiresAtMs: 1700000000000
      }
    });
  });

  test('POST /api/group-invite/respond accept adds membership and clears token', async () => {
    const deps = createDeps();
    deps.inviteState.isAuthenticated.mockReturnValue(true);
    deps.inviteState.getPendingInviteToken.mockResolvedValue('pending-token');
    deps.inviteToken.verifyInviteToken.mockReturnValue({ valid: true, groupId: '7' });

    const app = createApp({ ...deps, session: { userId: '11', isAuthenticated: true } });
    const res = await request(app)
      .post('/api/group-invite/respond')
      .send({ decision: 'accept' });

    expect(res.status).toBe(200);
    expect(deps.db.addUserToGroup).toHaveBeenCalledWith('7', '11');
    expect(deps.inviteState.clearPendingInvite).toHaveBeenCalledTimes(1);
  });

  test('POST /api/group-invite/respond decline clears token without membership write', async () => {
    const deps = createDeps();
    deps.inviteState.isAuthenticated.mockReturnValue(true);
    deps.inviteState.getPendingInviteToken.mockResolvedValue('pending-token');
    deps.inviteToken.verifyInviteToken.mockReturnValue({ valid: true, groupId: '7' });

    const app = createApp({ ...deps, session: { userId: '11', isAuthenticated: true } });
    const res = await request(app)
      .post('/api/group-invite/respond')
      .send({ decision: 'decline' });

    expect(res.status).toBe(200);
    expect(deps.db.addUserToGroup).not.toHaveBeenCalled();
    expect(deps.inviteState.clearPendingInvite).toHaveBeenCalledTimes(1);
  });
});
