const {
  fetchAndMapGroupEvents,
  mapDatabaseRowsToParticipants
} = require('../../../algorithm/algorithm_adapter.js');

describe('algorithm_adapter mapDatabaseRowsToParticipants', () => {
  test('maps rows by user and converts priority to blocking levels', () => {
    const rows = [
      {
        user_id: 'u1',
        event_start: '2026-02-20T10:00:00.000Z',
        event_end: '2026-02-20T11:00:00.000Z',
        priority: 1
      },
      {
        user_id: 'u1',
        event_start: '2026-02-20T12:00:00.000Z',
        event_end: '2026-02-20T13:00:00.000Z',
        priority: 3
      },
      {
        user_id: 'u2',
        event_start: null,
        event_end: null,
        priority: null
      }
    ];

    const participants = mapDatabaseRowsToParticipants(rows);

    expect(participants).toHaveLength(2);
    expect(participants[0]).toEqual({
      userId: 'u1',
      events: [
        {
          startMs: new Date('2026-02-20T10:00:00.000Z').getTime(),
          endMs: new Date('2026-02-20T11:00:00.000Z').getTime(),
          blockingLevel: 'B1'
        },
        {
          startMs: new Date('2026-02-20T12:00:00.000Z').getTime(),
          endMs: new Date('2026-02-20T13:00:00.000Z').getTime(),
          blockingLevel: 'B3'
        }
      ]
    });
    expect(participants[1]).toEqual({ userId: 'u2', events: [] });
  });

  test('defaults missing priority to B3', () => {
    const rows = [{
      user_id: 'u1',
      event_start: '2026-02-20T10:00:00.000Z',
      event_end: '2026-02-20T11:00:00.000Z',
      priority: null
    }];

    const participants = mapDatabaseRowsToParticipants(rows);
    expect(participants[0].events[0].blockingLevel).toBe('B3');
  });
});

describe('algorithm_adapter fetchAndMapGroupEvents', () => {
  test('executes DB query and returns mapped participants', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        user_id: 'u1',
        event_start: '2026-02-20T10:00:00.000Z',
        event_end: '2026-02-20T11:00:00.000Z',
        priority: 2
      }]
    });

    const db = { query };
    const start = Date.UTC(2026, 1, 20, 0, 0, 0, 0);
    const end = Date.UTC(2026, 1, 21, 0, 0, 0, 0);

    const participants = await fetchAndMapGroupEvents(db, 42, start, end);

    expect(query).toHaveBeenCalledTimes(1);
    const [, values] = query.mock.calls[0];
    expect(values).toEqual([
      new Date(start).toISOString(),
      new Date(end).toISOString(),
      42
    ]);

    expect(participants).toEqual([
      {
        userId: 'u1',
        events: [{
          startMs: new Date('2026-02-20T10:00:00.000Z').getTime(),
          endMs: new Date('2026-02-20T11:00:00.000Z').getTime(),
          blockingLevel: 'B2'
        }]
      }
    ]);
  });

  test('rethrows DB errors', async () => {
    const db = {
      query: jest.fn().mockRejectedValue(new Error('db down'))
    };

    await expect(
      fetchAndMapGroupEvents(db, 1, Date.now(), Date.now() + 1000)
    ).rejects.toThrow('db down');
  });
});
