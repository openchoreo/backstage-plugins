import {
  buildAuditQuery,
  resolveAuditWindow,
  suggestTimelineInterval,
  tokensToFilters,
} from './query';
import { AuditQueryToken } from './types';

describe('tokensToFilters', () => {
  it('nests actor and resource filters exactly as the record is shaped', () => {
    const tokens: AuditQueryToken[] = [
      { path: 'actor.id', value: 'alice@example.com' },
      { path: 'resource.project', value: 'checkout' },
      { path: 'resource.environment', value: 'default/production' },
    ];

    expect(tokensToFilters(tokens)).toEqual({
      actor: { id: ['alice@example.com'] },
      resource: { project: ['checkout'], environment: ['default/production'] },
    });
  });

  it('ORs values on one path into a single field', () => {
    const tokens: AuditQueryToken[] = [
      { path: 'result', value: 'denied' },
      { path: 'result', value: 'failure' },
    ];

    expect(tokensToFilters(tokens)).toEqual({ result: ['denied', 'failure'] });
  });

  it('drops a repeated value rather than sending it twice', () => {
    const tokens: AuditQueryToken[] = [
      { path: 'result', value: 'denied' },
      { path: 'result', value: 'denied' },
    ];

    expect(tokensToFilters(tokens)).toEqual({ result: ['denied'] });
  });

  it('sends free text as searchPhrase', () => {
    expect(tokensToFilters([{ path: null, value: 'occ' }])).toEqual({
      searchPhrase: 'occ',
    });
  });

  it('caps a field at the 20 values the API accepts', () => {
    const tokens: AuditQueryToken[] = Array.from({ length: 25 }, (_, i) => ({
      path: 'resource.name' as const,
      value: `resource-${i}`,
    }));

    expect(tokensToFilters(tokens).resource?.name).toHaveLength(20);
  });

  it('omits the groups entirely when nothing selects into them', () => {
    expect(
      tokensToFilters([{ path: 'result', value: 'denied' }]),
    ).not.toHaveProperty('actor');
  });
});

describe('resolveAuditWindow', () => {
  it('clamps a custom range wider than 366 days', () => {
    const result = resolveAuditWindow('custom', {
      startTime: '2020-01-01T00:00:00.000Z',
      endTime: '2026-01-01T00:00:00.000Z',
    });

    expect(result.clamped).toBe(true);
    expect(result.endTime).toBe('2026-01-01T00:00:00.000Z');
    const spanDays =
      (new Date(result.endTime).getTime() -
        new Date(result.startTime).getTime()) /
      86400000;
    expect(spanDays).toBeCloseTo(366, 5);
  });

  it('leaves an acceptable range alone', () => {
    const result = resolveAuditWindow('custom', {
      startTime: '2026-09-01T00:00:00.000Z',
      endTime: '2026-09-08T00:00:00.000Z',
    });

    expect(result).toEqual({
      startTime: '2026-09-01T00:00:00.000Z',
      endTime: '2026-09-08T00:00:00.000Z',
      clamped: false,
    });
  });
});

describe('suggestTimelineInterval', () => {
  it.each([
    ['2026-09-08T00:00:00Z', '2026-09-08T01:00:00Z', '1m'],
    ['2026-09-08T00:00:00Z', '2026-09-09T00:00:00Z', '30m'],
    ['2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z', '4h'],
    ['2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z', '1d'],
  ])('picks %s → %s as %s', (start, end, expected) => {
    expect(suggestTimelineInterval(start, end)).toBe(expected);
  });
});

describe('buildAuditQuery', () => {
  const auditWindow = {
    startTime: '2026-09-01T00:00:00.000Z',
    endTime: '2026-09-08T00:00:00.000Z',
    clamped: false,
  };

  it('includes the page controls when given', () => {
    expect(
      buildAuditQuery({
        window: auditWindow,
        tokens: [{ path: 'result', value: 'denied' }],
        limit: 100,
        sortOrder: 'desc',
      }),
    ).toEqual({
      startTime: auditWindow.startTime,
      endTime: auditWindow.endTime,
      limit: 100,
      sortOrder: 'desc',
      result: ['denied'],
    });
  });

  it('omits the timeline interval unless the timeline is asked for', () => {
    const withoutTimeline = buildAuditQuery({
      window: auditWindow,
      tokens: [],
      timelineInterval: '15m',
    });

    expect(withoutTimeline).not.toHaveProperty('includeTimeline');
    expect(withoutTimeline).not.toHaveProperty('timelineInterval');

    const withTimeline = buildAuditQuery({
      window: auditWindow,
      tokens: [],
      includeTimeline: true,
      timelineInterval: '15m',
    });

    expect(withTimeline.includeTimeline).toBe(true);
    expect(withTimeline.timelineInterval).toBe('15m');
  });
});
