jest.mock('../../../algorithm/algorithm_adapter.js', () => ({
  fetchAndMapGroupEvents: jest.fn()
}));

jest.mock('../../../algorithm/algorithm.js', () => ({
  computeAvailabilityBlocksAllViews: jest.fn()
}));

jest.mock('../../../db/dbInterface.js', () => ({}));

const { fetchAndMapGroupEvents } = require('../../../algorithm/algorithm_adapter.js');
const { computeAvailabilityBlocksAllViews } = require('../../../algorithm/algorithm.js');
const availabilityService = require('../../../services/availability_service.js');

describe('availability_service.getGroupAvailability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws 400 on invalid window', async () => {
    await expect(
      availabilityService.getGroupAvailability('3', 1000, 999)
    ).rejects.toMatchObject({ status: 400 });
  });

  test('throws 404 when group has no participants', async () => {
    fetchAndMapGroupEvents.mockResolvedValue([]);

    await expect(
      availabilityService.getGroupAvailability('3', 1000, 2000)
    ).rejects.toMatchObject({ status: 404 });

    expect(fetchAndMapGroupEvents).toHaveBeenCalledTimes(1);
  });

  test('maps StrictView fields into availability/count contract', async () => {
    fetchAndMapGroupEvents.mockResolvedValue([
      { userId: 'u1', events: [] },
      { userId: 'u2', events: [] }
    ]);

    computeAvailabilityBlocksAllViews.mockReturnValue([
      {
        startMs: 1000,
        endMs: 1900,
        views: {
          StrictView: {
            availableCount: 1,
            availabilityFraction: 0.5,
            totalCount: 2,
            freeUserIds: ['u1'],
            busyUserIds: ['u2'],
            busyCount: 1
          },
          FlexibleView: {
            availableCount: 2,
            availabilityFraction: 1,
            totalCount: 2,
            freeUserIds: ['u1', 'u2'],
            busyUserIds: [],
            busyCount: 0
          },
          LenientView: {
            availableCount: 2,
            availabilityFraction: 1,
            totalCount: 2,
            freeUserIds: ['u1', 'u2'],
            busyUserIds: [],
            busyCount: 0
          }
        }
      }
    ]);

    const result = await availabilityService.getGroupAvailability('3', 1000, 2000);

    expect(result.groupId).toBe('3');
    expect(result.availability).toEqual([
      {
        start: new Date(1000).toISOString(),
        end: new Date(1900).toISOString(),
        count: 1,
        availabilityFraction: 0.5,
        totalCount: 2
      }
    ]);
    expect(result.blocks).toEqual(result.availability);
  });
});
