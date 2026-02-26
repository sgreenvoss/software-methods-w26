const express = require('express');
const request = require('supertest');
const registerGroupRoutes = require('../../../routes/group_routes.js');

function createApp({ db, session = {} }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { ...session };
    next();
  });
  registerGroupRoutes(app, { db });
  return app;
}

function createDbMocks() {
  return {
    createGroupWithCreator: jest.fn().mockResolvedValue('25'),
    getGroupsByUID: jest.fn().mockResolvedValue([]),
    getGroupByID: jest.fn().mockResolvedValue([{ group_id: '25', group_name: 'Squad' }]),
    getGroupMembersByID: jest.fn().mockResolvedValue([{ user_id: '1', username: 'david' }]),
    leaveGroup: jest.fn().mockResolvedValue()
  };
}

describe('group routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /group/creation returns 401 when unauthenticated', async () => {
    const db = createDbMocks();
    const app = createApp({ db, session: {} });

    const res = await request(app).post('/group/creation?group_name=My+Group');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  test('POST /group/creation returns 400 when group_name missing/blank', async () => {
    const db = createDbMocks();
    const app = createApp({ db, session: { userId: '1', isAuthenticated: true } });

    const res = await request(app).post('/group/creation?group_name=   ');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /group/creation returns 201 with membershipAdded true on success', async () => {
    const db = createDbMocks();
    db.createGroupWithCreator.mockResolvedValue('88');
    const app = createApp({ db, session: { userId: '1', isAuthenticated: true } });

    const res = await request(app).post('/group/creation?group_name=Project+X');

    expect(res.status).toBe(201);
    expect(db.createGroupWithCreator).toHaveBeenCalledWith('Project X', '1');
    expect(res.body).toEqual({
      success: true,
      groupId: '88',
      groupName: 'Project X',
      membershipAdded: true
    });
  });

  test('GET /group/:groupId numeric route returns payload', async () => {
    const db = createDbMocks();
    const app = createApp({ db, session: { userId: '1', isAuthenticated: true } });

    const res = await request(app).get('/group/42');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.getGroupByID).toHaveBeenCalledWith('42');
  });

  test('GET /group/respond-invitation does not match numeric /group/:groupId route', async () => {
    const db = createDbMocks();
    const app = createApp({ db, session: { userId: '1', isAuthenticated: true } });

    const res = await request(app).get('/group/respond-invitation');

    expect(res.status).toBe(404);
    expect(db.getGroupByID).not.toHaveBeenCalled();
  });
});
