jest.mock('../../../services/availability_service.js', () => ({
  getGroupAvailability: jest.fn()
}));

const availabilityService = require('../../../services/availability_service.js');
const availabilityController = require('../../../availability_controller.js');

function createRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    }
  };
}

describe('availability_controller.getAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when unauthenticated', async () => {
    const req = { session: {}, params: { groupId: '10' }, query: {} };
    const res = createRes();

    await availabilityController.getAvailability(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual({ ok: false, message: 'Unauthorized' });
  });

  test('returns 400 for invalid/missing timestamps', async () => {
    const req = {
      session: { userId: '1' },
      params: { groupId: '10' },
      query: { windowStartMs: 'bad', windowEndMs: '2000' }
    };
    const res = createRes();

    await availabilityController.getAvailability(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.ok).toBe(false);
    expect(res.payload.error).toMatch(/Invalid or missing timestamps/);
  });

  test('returns 200 with service payload on success', async () => {
    availabilityService.getGroupAvailability.mockResolvedValue({
      groupId: '10',
      availability: [{ start: 's', end: 'e', count: 1 }],
      blocks: [{ start: 's', end: 'e', count: 1 }]
    });

    const req = {
      session: { userId: '1' },
      params: { groupId: '10' },
      query: { windowStartMs: '1000', windowEndMs: '2000' }
    };
    const res = createRes();

    await availabilityController.getAvailability(req, res);

    expect(availabilityService.getGroupAvailability).toHaveBeenCalledWith('10', 1000, 2000);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      ok: true,
      groupId: '10',
      availability: [{ start: 's', end: 'e', count: 1 }],
      blocks: [{ start: 's', end: 'e', count: 1 }]
    });
  });

  test('propagates service error status codes', async () => {
    const err = new Error('boom');
    err.status = 418;
    availabilityService.getGroupAvailability.mockRejectedValue(err);

    const req = {
      session: { userId: '1' },
      params: { groupId: '10' },
      query: { windowStartMs: '1000', windowEndMs: '2000' }
    };
    const res = createRes();

    await availabilityController.getAvailability(req, res);

    expect(res.statusCode).toBe(418);
    expect(res.payload).toEqual({ ok: false, error: 'boom' });
  });
});
