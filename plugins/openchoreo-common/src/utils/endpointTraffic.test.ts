import type { EndpointTrafficBackend } from '../types/endpoint-traffic-types';
import {
  backendLabel,
  backendMatchProblems,
  describeMatch,
  effectiveBackends,
  keptOverrides,
  matchProblem,
  overridesFor,
  ownMatches,
  capabilityProblems,
  inMatchOrder,
  sameMatch,
  sameRatio,
  splitOf,
  splitPercents,
  splitProblem,
  trafficOf,
  uniqueBackendName,
  prunedOverrides,
} from './endpointTraffic';

const backend = (
  name: string,
  weight: number,
  extra: Partial<EndpointTrafficBackend> = {},
): EndpointTrafficBackend => ({
  name,
  componentName: name,
  endpoint: 'http',
  weight,
  ...extra,
});

const trips = (): EndpointTrafficBackend[] => [
  backend('trips-python', 50),
  backend('trips-stale', 50),
  backend('trips-go', 0, {
    match: { headers: [{ name: 'x-preview', value: 'true' }] },
  }),
  backend('trips-shadow', 0, { mirror: { percent: 10 } }),
];

describe('splitPercents', () => {
  it('adds up to exactly 100', () => {
    expect(splitPercents([1, 2])).toEqual([33, 67]);
    expect(splitPercents([4000, 4000, 2000])).toEqual([40, 40, 20]);
    expect(splitPercents([0, 0])).toEqual([0, 0]);
  });
});

describe('splitOf and effectiveBackends', () => {
  it('reads shares as percentages and a mirror as its copy', () => {
    expect(splitOf(trips())).toEqual({
      'trips-python': 50,
      'trips-stale': 50,
      'trips-go': 0,
      'trips-shadow': 10,
    });
  });

  it('applies an environment’s overrides', () => {
    const own = effectiveBackends(trips(), [
      { name: 'trips-python', weight: 45 },
      { name: 'trips-go', weight: 5 },
      { name: 'trips-shadow', mirror: { percent: 25 } },
    ]);
    expect(splitOf(own)).toEqual({
      'trips-python': 90,
      'trips-stale': 0,
      'trips-go': 10,
      'trips-shadow': 25,
    });
  });

  it('follows the release’s weights when the environment has no own split', () => {
    const own = effectiveBackends(trips(), [
      { name: 'trips-shadow', mirror: { percent: 25 } },
    ]);
    expect(own.map(b => b.weight)).toEqual([50, 50, 0, 0]);
  });
});

describe('splitProblem', () => {
  const full = { 'trips-python': 45, 'trips-stale': 50, 'trips-go': 5 };

  it('accepts shares that add up to 100', () => {
    expect(splitProblem(trips(), full)).toBe('');
    expect(splitProblem(trips(), { ...full, 'trips-shadow': 30 })).toBe('');
  });

  it('says how far off the total is', () => {
    expect(splitProblem(trips(), { ...full, 'trips-go': 15 })).toBe(
      'Total 110%. Take 10% off a backend.',
    );
    expect(splitProblem(trips(), { ...full, 'trips-go': 0 })).toBe(
      'Total 95%. Add 5% to a backend.',
    );
  });

  it('refuses unknown backends, missing shares and bad numbers', () => {
    expect(splitProblem(trips(), { 'trips-java': 100 })).toBe(
      'No backend named trips-java',
    );
    expect(splitProblem(trips(), { 'trips-python': 100 })).toBe(
      'Give a share for trips-stale / http, trips-go / http',
    );
    expect(splitProblem(trips(), { ...full, 'trips-go': 2.5 })).toBe(
      'trips-go / http: give a whole percentage from 0 to 100',
    );
  });
});

describe('backendLabel', () => {
  it('names the workload endpoint, with its release line', () => {
    expect(backendLabel(backend('trips', 100))).toBe('trips / http');
    expect(
      backendLabel(
        backend('trips-go-rewrite', 0, {
          componentName: 'trips',
          releaseLine: 'go-rewrite',
        }),
      ),
    ).toBe('trips @ go-rewrite / http');
  });
});

describe('overridesFor', () => {
  it('stores every weight when the shares differ', () => {
    expect(
      overridesFor(trips(), {
        'trips-python': 45,
        'trips-stale': 50,
        'trips-go': 5,
      }),
    ).toEqual([
      { name: 'trips-python', weight: 45 },
      { name: 'trips-stale', weight: 50 },
      { name: 'trips-go', weight: 5 },
    ]);
  });

  it('stores nothing for the release’s own split', () => {
    expect(overridesFor(trips(), splitOf(trips()))).toEqual([]);
  });

  it('stores a copy only when it differs', () => {
    expect(overridesFor(trips(), { 'trips-shadow': 25 })).toEqual([
      { name: 'trips-shadow', mirror: { percent: 25 } },
    ]);
  });
});

describe('sameRatio', () => {
  it('compares ratios, not numbers', () => {
    expect(sameRatio([1, 1], [50, 50])).toBe(true);
    expect(sameRatio([1, 1], [45, 55])).toBe(false);
    expect(sameRatio([0, 0], [0, 0])).toBe(true);
  });
});

describe('matches', () => {
  it('checks a match as the CRD does', () => {
    expect(backendMatchProblems({})).toEqual(['Add a header, cookie or path']);
    expect(
      backendMatchProblems({ headers: [{ name: 'bad name', value: '1' }] }),
    ).toEqual(['Header name "bad name" is not a valid HTTP header name']);
  });

  it('refuses a match another backend already has', () => {
    expect(
      matchProblem(trips(), 'trips-beta', {
        headers: [{ name: 'X-Preview', value: 'true' }],
      }),
    ).toBe('trips-go already gets the requests that meet these conditions');
    expect(
      matchProblem(trips(), 'trips-go', {
        headers: [{ name: 'x-preview', value: 'true' }],
      }),
    ).toBe('');
  });

  it('describes a match in one line', () => {
    expect(
      describeMatch({
        path: { value: '/next' },
        headers: [{ name: 'x-preview', value: 'true' }],
        cookies: [{ name: 'group', value: 'b' }],
      }),
    ).toBe('path /next and header x-preview: true and cookie group=b');
  });

  it('reads back how a backend gets traffic', () => {
    const [python, , go, shadow] = trips();
    expect(trafficOf(python)).toEqual({ kind: 'weight' });
    expect(trafficOf(go).kind).toBe('match');
    expect(trafficOf(shadow)).toEqual({ kind: 'mirror', percent: 10 });
  });
});

describe('uniqueBackendName', () => {
  it('names a backend after its component, then its endpoint', () => {
    expect(
      uniqueBackendName(trips(), {
        componentName: 'trips-java',
        endpoint: 'http',
      }),
    ).toBe('trips-java');
    expect(
      uniqueBackendName(trips(), {
        componentName: 'trips-go',
        endpoint: 'grpc',
      }),
    ).toBe('trips-go-grpc');
    expect(
      uniqueBackendName(trips(), {
        componentName: 'trips',
        endpoint: 'http',
        releaseLine: 'next',
      }),
    ).toBe('trips-next');
  });
});

describe('keptOverrides', () => {
  const release = (): EndpointTrafficBackend[] => [
    backend('trips-python', 50),
    backend('trips-stale', 50),
  ];

  it('drops an own split that gave a removed backend a share', () => {
    expect(
      keptOverrides(release(), [
        { name: 'trips-python', weight: 45 },
        { name: 'trips-stale', weight: 50 },
        { name: 'trips-go', weight: 5 },
      ]),
    ).toEqual([]);
  });

  it('keeps the rest when the removed backend had no share there', () => {
    expect(
      keptOverrides(
        [backend('trips-stale', 50), backend('trips-go', 0)],
        [
          { name: 'trips-python', weight: 0 },
          { name: 'trips-stale', weight: 50 },
          { name: 'trips-go', weight: 50 },
        ],
      ),
    ).toEqual([
      { name: 'trips-stale', weight: 50 },
      { name: 'trips-go', weight: 50 },
    ]);
  });

  it('gives a backend the release adds no share in an own split', () => {
    const next = [
      backend('trips-python', 50),
      backend('trips-go', 0, {
        match: { headers: [{ name: 'x-preview', value: 'true' }] },
      }),
      backend('trips-stale', 50),
    ];
    const kept = keptOverrides(next, [
      { name: 'trips-python', weight: 80 },
      { name: 'trips-go', weight: 20 },
    ]);
    expect(kept).toEqual([
      { name: 'trips-python', weight: 80 },
      { name: 'trips-go', weight: 20 },
      { name: 'trips-stale', weight: 0 },
    ]);
    expect(splitOf(effectiveBackends(next, kept))).toEqual({
      'trips-python': 80,
      'trips-go': 20,
      'trips-stale': 0,
    });
  });

  it('drops an own split that equals the release’s or routes nothing', () => {
    expect(
      keptOverrides(release(), [
        { name: 'trips-python', weight: 1 },
        { name: 'trips-stale', weight: 1 },
      ]),
    ).toEqual([]);
    expect(
      keptOverrides(release(), [
        { name: 'trips-python', weight: 0 },
        { name: 'trips-stale', weight: 0 },
      ]),
    ).toEqual([]);
  });
});

describe('own conditions', () => {
  const beta = { path: { value: '/beta' } };

  it('applies an environment’s condition only to a backend with one', () => {
    const own = effectiveBackends(trips(), [
      { name: 'trips-go', match: beta },
      { name: 'trips-python', match: beta },
    ]);
    expect(own.find(b => b.name === 'trips-go')?.match).toEqual(beta);
    expect(own.find(b => b.name === 'trips-python')?.match).toBeUndefined();
  });

  it('stores a condition only when it differs from the release’s', () => {
    expect(
      overridesFor(trips(), {}, { 'trips-go': beta, 'trips-python': beta }),
    ).toEqual([{ name: 'trips-go', match: beta }]);
    expect(
      overridesFor(
        trips(),
        {},
        {
          'trips-go': {
            headers: [{ name: 'X-Preview', type: 'Exact', value: 'true' }],
          },
        },
      ),
    ).toEqual([]);
  });

  it('puts a condition and a weight on one entry', () => {
    expect(
      overridesFor(
        trips(),
        { 'trips-python': 45, 'trips-stale': 50, 'trips-go': 5 },
        { 'trips-go': beta },
      ),
    ).toContainEqual({ name: 'trips-go', weight: 5, match: beta });
  });

  it('compares matches with the CRD’s defaults', () => {
    expect(
      sameMatch(
        { path: { value: '/a' } },
        { path: { type: 'PathPrefix', value: '/a' } },
      ),
    ).toBe(true);
    expect(sameMatch({ path: { value: '/a' } }, undefined)).toBe(false);
  });

  it('keeps own conditions when an own split is dropped', () => {
    const release = trips().filter(b => b.name !== 'trips-stale');
    const kept = keptOverrides(release, [
      { name: 'trips-python', weight: 45 },
      { name: 'trips-stale', weight: 50 },
      { name: 'trips-go', weight: 5, match: beta },
    ]);
    expect(kept).toEqual([{ name: 'trips-go', match: beta }]);
    expect(ownMatches(release, kept)).toEqual({ 'trips-go': beta });
  });

  it('drops a condition once the backend has none in the release', () => {
    const release = trips().map(b =>
      b.name === 'trips-go' ? { ...b, match: undefined } : b,
    );
    expect(keptOverrides(release, [{ name: 'trips-go', match: beta }])).toEqual(
      [],
    );
  });
});

describe('match order', () => {
  it('checks the most specific match first, as Gateway API ranks them', () => {
    const header = [{ name: 'x-preview', value: 'true' }];
    const ordered = inMatchOrder([
      backend('plain', 100),
      backend('testers', 0, {
        match: { headers: header, cookies: [{ name: 'g', value: 'b' }] },
      }),
      backend('api', 0, { match: { path: { value: '/api/' } } }),
      backend('trips', 0, {
        match: { path: { type: 'Exact', value: '/trips' } },
      }),
      backend('api-beta', 0, {
        match: { path: { value: '/api' }, headers: header },
      }),
      backend('root', 0, { match: { path: { value: '/' } } }),
    ]).map(b => b.name);
    expect(ordered).toEqual([
      'trips',
      'api-beta',
      'api',
      'testers',
      'root', // the "/" prefix is no path condition, with none of its own
      'plain',
    ]);
  });
});

describe('capabilityProblems', () => {
  it('refuses what the type can’t render, and nothing when it declares nothing', () => {
    const backends = [
      backend('recs', 0, { match: { cookies: [{ name: 'g', value: 'b' }] } }),
      backend('shadow', 0, { mirror: { percent: 10 } }),
    ];
    expect(capabilityProblems(backends, undefined)).toEqual([]);
    expect(capabilityProblems(backends, ['Match', 'Mirror'])).toEqual([
      'recs: a cookie condition needs the RegularExpression capability',
      'shadow: mirroring a share of requests needs the MirrorPercent capability',
    ]);
  });
});

describe('keptOverrides with a mirror', () => {
  it('keeps a copy share when the split goes', () => {
    const release = [
      backend('trips-python', 50),
      backend('trips-shadow', 0, { mirror: { percent: 10 } }),
    ];
    expect(
      keptOverrides(release, [
        { name: 'trips-python', weight: 45 },
        { name: 'trips-go', weight: 55 },
        { name: 'trips-shadow', mirror: { percent: 30 } },
      ]),
    ).toEqual([{ name: 'trips-shadow', mirror: { percent: 30 } }]);
  });
});

describe('prunedOverrides', () => {
  const release = () => [
    backend('trips-python', 1),
    backend('trips-stale', 0),
    backend('trips-go', 0),
  ];

  it('keeps what the environment serves when an ignored entry had a share', () => {
    expect(
      prunedOverrides(release(), [
        { name: 'trips-stale', weight: 50 },
        { name: 'trips-go', weight: 50 },
        { name: 'trips-java', weight: 20 },
      ]),
    ).toEqual([
      { name: 'trips-python', weight: 0 },
      { name: 'trips-stale', weight: 50 },
      { name: 'trips-go', weight: 50 },
    ]);
  });

  it('drops an own split equal to the release’s', () => {
    expect(
      prunedOverrides(release(), [
        { name: 'trips-python', weight: 3 },
        { name: 'trips-java', weight: 1 },
      ]),
    ).toEqual([]);
  });

  it('leaves an own split that routes nothing alone', () => {
    expect(
      prunedOverrides(release(), [{ name: 'trips-stale', weight: 0 }]),
    ).toBeUndefined();
  });
});

describe('backendMatchProblems on a malformed match', () => {
  it('refuses what isn’t a match instead of throwing', () => {
    const bad = (m: unknown) => backendMatchProblems(m as never);
    expect(bad({ headers: 'x-version' })).toEqual([
      'A match takes a path, a list of headers and a list of cookies',
    ]);
    expect(bad({ path: 'next' })).toHaveLength(1);
    expect(bad({ headers: [null] })).toEqual([
      'Each header and cookie takes a name and a value',
    ]);
    expect(bad({ cookies: [{ name: 'beta' }] })).toEqual([
      'Each header and cookie takes a name and a value',
    ]);
  });
});

describe('comparing and checking matches and splits', () => {
  it('reads headers in any order as the same match', () => {
    const a = {
      headers: [
        { name: 'x-a', value: '1' },
        { name: 'X-B', value: '2' },
      ],
    };
    const b = {
      headers: [
        { name: 'x-b', value: '2' },
        { name: 'x-a', value: '1' },
      ],
    };
    expect(sameMatch(a, b)).toBe(true);
    expect(sameMatch(a, { headers: [{ name: 'x-a', value: '1' }] })).toBe(
      false,
    );
  });

  it('finds a repeated cookie match whatever its field order', () => {
    const backends = [
      backend('trips-python', 100),
      backend('trips-go', 0, {
        match: { cookies: [{ name: 'beta', value: 'yes' }] },
      }),
    ];
    const reordered = { cookies: [{ value: 'yes', name: 'beta' }] } as never;
    expect(matchProblem(backends, 'trips-new', reordered)).not.toBe('');
  });

  it('reads a split from its own keys only', () => {
    const backends = [backend('constructor', 50), backend('trips', 50)];
    expect(splitProblem(backends, { trips: 100 })).toBe(
      'Give a share for constructor / http',
    );
  });
});
