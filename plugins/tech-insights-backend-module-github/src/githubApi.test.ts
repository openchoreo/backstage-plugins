import { isRateLimited } from './githubApi';

describe('isRateLimited', () => {
  it.each([
    ['a 429', 429, {}],
    ['an exhausted primary limit', 403, { 'x-ratelimit-remaining': '0' }],
    [
      'a secondary limit',
      403,
      { 'retry-after': '60', 'x-ratelimit-remaining': '4321' },
    ],
  ])('treats %s as a rate limit', (_label, status, headers) => {
    expect(isRateLimited(status, new Headers(headers))).toBe(true);
  });

  it.each([
    ['a 403 without rate-limit headers', 403, {}],
    ['a 403 with quota left', 403, { 'x-ratelimit-remaining': '4321' }],
    ['a 404', 404, { 'x-ratelimit-remaining': '0' }],
  ])('treats %s as an ordinary response', (_label, status, headers) => {
    expect(isRateLimited(status, new Headers(headers))).toBe(false);
  });
});
