import { getRelativeTime } from './relativeTime';

describe('getRelativeTime', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const secondsAgo = (s: number) => NOW - s * 1000;

  it('returns "just now" under a minute', () => {
    expect(getRelativeTime(NOW)).toBe('just now');
    expect(getRelativeTime(secondsAgo(59))).toBe('just now');
  });

  it('formats minutes with pluralization', () => {
    expect(getRelativeTime(secondsAgo(60))).toBe('1 minute ago');
    expect(getRelativeTime(secondsAgo(5 * 60))).toBe('5 minutes ago');
    expect(getRelativeTime(secondsAgo(59 * 60 + 59))).toBe('59 minutes ago');
  });

  it('formats hours with pluralization', () => {
    expect(getRelativeTime(secondsAgo(60 * 60))).toBe('1 hour ago');
    expect(getRelativeTime(secondsAgo(23 * 60 * 60))).toBe('23 hours ago');
  });

  it('formats days with pluralization', () => {
    expect(getRelativeTime(secondsAgo(24 * 60 * 60))).toBe('1 day ago');
    expect(getRelativeTime(secondsAgo(10 * 24 * 60 * 60))).toBe('10 days ago');
  });
});
