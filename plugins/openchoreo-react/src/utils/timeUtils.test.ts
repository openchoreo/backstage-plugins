import { formatRelativeTime, calculateTimeRange } from './timeUtils';

describe('formatRelativeTime', () => {
  const NOW = new Date('2025-06-15T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats seconds ago', () => {
    const date = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('30 seconds ago');
  });

  it('formats 1 minute ago (singular)', () => {
    const date = new Date(NOW.getTime() - 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 minute ago');
  });

  it('formats minutes ago (plural)', () => {
    const date = new Date(NOW.getTime() - 15 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('15 minutes ago');
  });

  it('formats 1 hour ago (singular)', () => {
    const date = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 hour ago');
  });

  it('formats hours ago (plural)', () => {
    const date = new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('5 hours ago');
  });

  it('formats 1 day ago (singular)', () => {
    const date = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(date)).toBe('1 day ago');
  });

  it('formats days ago (plural)', () => {
    const date = new Date(
      NOW.getTime() - 10 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(date)).toBe('10 days ago');
  });

  it('formats 1 month ago (singular)', () => {
    const date = new Date(
      NOW.getTime() - 35 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(date)).toBe('1 month ago');
  });

  it('formats months ago (plural)', () => {
    const date = new Date(
      NOW.getTime() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(date)).toBe('3 months ago');
  });

  it('formats 1 year ago (singular)', () => {
    const date = new Date(
      NOW.getTime() - 400 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(date)).toBe('1 year ago');
  });

  it('formats years ago (plural)', () => {
    const date = new Date(
      NOW.getTime() - 800 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatRelativeTime(date)).toBe('2 years ago');
  });
});

describe('calculateTimeRange', () => {
  const NOW = new Date('2025-06-15T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['10m', 10 * 60 * 1000],
    ['30m', 30 * 60 * 1000],
    ['1h', 60 * 60 * 1000],
    ['24h', 24 * 60 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
    ['14d', 14 * 24 * 60 * 60 * 1000],
  ])('calculates correct range for %s', (range, expectedMs) => {
    const result = calculateTimeRange(range);
    const startMs = new Date(result.startTime).getTime();
    const endMs = new Date(result.endTime).getTime();

    expect(endMs - startMs).toBe(expectedMs);
    expect(result.endTime).toBe(NOW.toISOString());
  });

  it('defaults to 1h for unknown range', () => {
    const result = calculateTimeRange('unknown');
    const startMs = new Date(result.startTime).getTime();
    const endMs = new Date(result.endTime).getTime();

    expect(endMs - startMs).toBe(60 * 60 * 1000);
  });
});
