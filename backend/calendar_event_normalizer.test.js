const { deriveAllDayMetadata, normalizeCalendarEvent } = require('./calendar_event_normalizer');

describe('calendar_event_normalizer', () => {
  test('marks midnight UTC whole-day ranges as all-day', () => {
    const normalized = normalizeCalendarEvent({
      title: 'All Day',
      start: '2026-03-03T00:00:00.000Z',
      end: '2026-03-04T00:00:00.000Z',
      event_id: 'all-day-1'
    });

    expect(normalized.isAllDay).toBe(true);
    expect(normalized.allDayStartDate).toBe('2026-03-03');
    expect(normalized.allDayEndDate).toBe('2026-03-04');
    expect(normalized.start).toBe('2026-03-03T00:00:00.000Z');
    expect(normalized.end).toBe('2026-03-04T00:00:00.000Z');
  });

  test('leaves normal timed ISO events as timed events', () => {
    const metadata = deriveAllDayMetadata(
      '2026-03-03T10:30:00.000Z',
      '2026-03-03T12:00:00.000Z'
    );

    expect(metadata.isAllDay).toBe(false);
    expect(metadata.allDayStartDate).toBeUndefined();
    expect(metadata.allDayEndDate).toBeUndefined();
  });

  test('does not mark non-whole-day midnight UTC ranges as all-day', () => {
    const metadata = deriveAllDayMetadata(
      '2026-03-03T00:00:00.000Z',
      '2026-03-03T12:00:00.000Z'
    );

    expect(metadata.isAllDay).toBe(false);
    expect(metadata.allDayStartDate).toBeUndefined();
    expect(metadata.allDayEndDate).toBeUndefined();
  });
});
