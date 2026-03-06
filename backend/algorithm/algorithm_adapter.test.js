const { fetchAndMapGroupEvents, mapDatabaseRowsToParticipants } = require('./algorithm_adapter');

describe('algorithm_adapter', () => {
    test('normalizes blocking levels from SQL rows and defaults invalid values to B3', () => {
        const rows = [
            {
                user_id: 10,
                event_start: '2026-03-01T10:00:00.000Z',
                event_end: '2026-03-01T11:00:00.000Z',
                blocking_level: 'b1'
            },
            {
                user_id: 10,
                event_start: '2026-03-01T11:00:00.000Z',
                event_end: '2026-03-01T12:00:00.000Z',
                blocking_level: 'B2'
            },
            {
                user_id: 10,
                event_start: '2026-03-01T12:00:00.000Z',
                event_end: '2026-03-01T13:00:00.000Z',
                blocking_level: 'invalid'
            },
            {
                user_id: 10,
                event_start: '2026-03-01T13:00:00.000Z',
                event_end: '2026-03-01T14:00:00.000Z',
                blocking_level: null
            }
        ];

        const participants = mapDatabaseRowsToParticipants(rows);
        expect(participants).toHaveLength(1);
        expect(participants[0].events.map((event) => event.blockingLevel)).toEqual([
            'B1',
            'B2',
            'B3',
            'B3'
        ]);
    });

    test('preserves selected-group users with no calendar rows and no petition rows', () => {
        const rows = [
            {
                user_id: 21,
                event_start: null,
                event_end: null,
                blocking_level: null
            },
            {
                user_id: 22,
                event_start: '2026-03-01T08:00:00.000Z',
                event_end: '2026-03-01T09:00:00.000Z',
                blocking_level: 'B3'
            }
        ];

        const participants = mapDatabaseRowsToParticipants(rows);
        expect(participants).toHaveLength(2);

        const byUser = new Map(participants.map((participant) => [participant.userId, participant]));
        expect(byUser.get(21)).toBeDefined();
        expect(byUser.get(21).events).toEqual([]);
        expect(byUser.get(22).events).toHaveLength(1);
    });

    test('builds petition-aware query with accepted filtering, declined exclusion, and no petition-group restriction', async() => {
        const fakeDb = {
            query: jest.fn().mockResolvedValue({
                rows: [
                    { user_id: 1, event_start: null, event_end: null, blocking_level: null }
                ]
            })
        };

        const windowStartMs = Date.parse('2026-03-01T00:00:00.000Z');
        const windowEndMs = Date.parse('2026-03-08T00:00:00.000Z');
        const groupId = 77;

        const participants = await fetchAndMapGroupEvents(fakeDb, groupId, windowStartMs, windowEndMs);
        expect(Array.isArray(participants)).toBe(true);

        expect(fakeDb.query).toHaveBeenCalledTimes(1);
        const [sql, values] = fakeDb.query.mock.calls[0];

        expect(values).toEqual([
            new Date(windowStartMs).toISOString(),
            new Date(windowEndMs).toISOString(),
            groupId
        ]);

        expect(sql).toMatch(/petition_rows/i);
        expect(sql).toMatch(/pr\.response\s*=\s*'ACCEPTED'/i);
        expect(sql).toMatch(/NOT EXISTS/i);
        expect(sql).toMatch(/pr_declined\.response\s*=\s*'DECLINED'/i);
        expect(sql).toMatch(/FROM\s+group_users\s+gu\s+LEFT\s+JOIN\s+event_rows\s+er/i);

        // Must include cross-group accepted petitions: no selected-group filter on petitions.
        expect(sql).not.toMatch(/p\.group_id\s*=\s*\$\d+/i);
    });

    test('keeps calendar overlap semantics while mapping calendar-derived blocking levels', async() => {
        const fakeDb = {
            query: jest.fn().mockResolvedValue({
                rows: [
                    {
                        user_id: 5,
                        event_start: '2026-03-03T12:00:00.000Z',
                        event_end: '2026-03-03T13:00:00.000Z',
                        blocking_level: 'B2'
                    }
                ]
            })
        };

        const participants = await fetchAndMapGroupEvents(
            fakeDb,
            9,
            Date.parse('2026-03-01T00:00:00.000Z'),
            Date.parse('2026-03-08T00:00:00.000Z')
        );

        expect(participants).toHaveLength(1);
        expect(participants[0].events).toHaveLength(1);
        expect(participants[0].events[0].blockingLevel).toBe('B2');

        const sql = fakeDb.query.mock.calls[0][0];
        expect(sql).toMatch(/ce\.event_end\s*>\s*\$1/i);
        expect(sql).toMatch(/ce\.event_start\s*<\s*\$2/i);
    });
});
