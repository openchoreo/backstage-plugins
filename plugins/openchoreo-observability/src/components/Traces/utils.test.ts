import {
  parseRfc3339NanoToNanoseconds,
  nanosecondsToRfc3339Nano,
  formatDuration,
  formatTime,
  formatTimeFromString,
  calculateTimeRange,
} from './utils';

// ---- Tests ----

describe('parseRfc3339NanoToNanoseconds', () => {
  it('converts RFC3339 timestamp to nanoseconds', () => {
    const result = parseRfc3339NanoToNanoseconds(
      '2024-06-01T10:00:00.000000000Z',
    );
    const expectedMs = new Date('2024-06-01T10:00:00Z').getTime();
    expect(result).toBe(expectedMs * 1_000_000);
  });

  it('handles fractional seconds', () => {
    const result = parseRfc3339NanoToNanoseconds(
      '2024-06-01T10:00:00.123456789Z',
    );
    const expectedMs = new Date('2024-06-01T10:00:00.123Z').getTime();
    expect(result).toBe(expectedMs * 1_000_000 + 456789);
  });

  it('pads short fractional parts', () => {
    const result = parseRfc3339NanoToNanoseconds('2024-06-01T10:00:00.5Z');
    const expectedMs = new Date('2024-06-01T10:00:00.500Z').getTime();
    expect(result).toBe(expectedMs * 1_000_000);
  });
});

describe('nanosecondsToRfc3339Nano', () => {
  it('converts nanoseconds to RFC3339 string', () => {
    const ms = new Date('2024-06-01T10:00:00Z').getTime();
    const ns = ms * 1_000_000;
    const result = nanosecondsToRfc3339Nano(ns);
    expect(result).toMatch(/2024-06-01T10:00:00/);
    expect(result).toMatch(/Z$/);
  });
});

describe('formatDuration', () => {
  it('formats nanoseconds', () => {
    expect(formatDuration(500)).toBe('500ns');
  });

  it('formats microseconds', () => {
    expect(formatDuration(5000)).toBe('5.000μs');
  });

  it('formats milliseconds', () => {
    expect(formatDuration(5000000)).toBe('5.000ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1500000000)).toBe('1.500s');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0ns');
  });
});

describe('formatTime', () => {
  it('converts nanoseconds to ISO string', () => {
    const ms = new Date('2024-06-01T10:00:00Z').getTime();
    const ns = ms * 1_000_000;
    expect(formatTime(ns)).toBe('2024-06-01T10:00:00.000Z');
  });
});

describe('formatTimeFromString', () => {
  it('returns string as-is if it ends with Z', () => {
    expect(formatTimeFromString('2024-06-01T10:00:00Z')).toBe(
      '2024-06-01T10:00:00Z',
    );
  });

  it('appends Z if missing', () => {
    expect(formatTimeFromString('2024-06-01T10:00:00')).toBe(
      '2024-06-01T10:00:00Z',
    );
  });
});

describe('calculateTimeRange', () => {
  it('returns start and end time for 10m', () => {
    const result = calculateTimeRange('10m');
    const diff =
      new Date(result.endTime).getTime() - new Date(result.startTime).getTime();
    expect(diff).toBe(10 * 60 * 1000);
  });

  it('returns start and end time for 1h', () => {
    const result = calculateTimeRange('1h');
    const diff =
      new Date(result.endTime).getTime() - new Date(result.startTime).getTime();
    expect(diff).toBe(60 * 60 * 1000);
  });

  it('returns start and end time for 7d', () => {
    const result = calculateTimeRange('7d');
    const diff =
      new Date(result.endTime).getTime() - new Date(result.startTime).getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('defaults to 1h for unknown range', () => {
    const result = calculateTimeRange('unknown');
    const diff =
      new Date(result.endTime).getTime() - new Date(result.startTime).getTime();
    expect(diff).toBe(60 * 60 * 1000);
  });
});
