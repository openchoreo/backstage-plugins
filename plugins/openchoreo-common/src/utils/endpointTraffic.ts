import type {
  BackendTraffic,
  EndpointBackendMatch,
  EndpointCapability,
  EndpointSplit,
  EndpointTrafficBackend,
  EndpointTrafficOverride,
} from '../types/endpoint-traffic-types';

/** Whether a backend only gets copies. */
export const isMirror = (b: EndpointTrafficBackend): boolean =>
  b.mirror !== undefined;

/** How a backend gets requests, read back from its backendRef. */
export function trafficOf(b: EndpointTrafficBackend): BackendTraffic {
  if (b.mirror) return { kind: 'mirror', percent: b.mirror.percent };
  if (b.match) return { kind: 'match', match: b.match };
  return { kind: 'weight' };
}

/**
 * Whole-number percentages that add up to exactly `total` (largest
 * remainder), in proportion to `weights`, so a 1:2 split reads 33 / 67 and
 * never 33 / 66. All-zero weights give 0s.
 */
export function splitPercents(weights: number[], total = 100): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map(w => (w / sum) * total);
  const floors = exact.map(Math.floor);
  let remaining = total - floors.reduce((acc, p) => acc + p, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors;
}

/**
 * The backends with an environment's overrides applied, as the controller
 * applies them: a weight to a backend that isn't a mirror, a condition to
 * one that has a condition in the release, a copy share to a mirror. When
 * the environment has its own split, a backend it doesn't name gets 0, so a
 * backend a new release adds takes none of its traffic until it is given a
 * share there.
 */
export function effectiveBackends(
  backends: EndpointTrafficBackend[],
  overrides: EndpointTrafficOverride[],
): EndpointTrafficBackend[] {
  const ownSplit = overrides.some(
    o =>
      o.weight !== undefined &&
      backends.some(b => b.name === o.name && !isMirror(b)),
  );
  return backends.map(b => {
    const o = overrides.find(x => x.name === b.name);
    if (!o) return ownSplit && !isMirror(b) ? { ...b, weight: 0 } : b;
    if (isMirror(b)) return o.mirror ? { ...b, mirror: o.mirror } : b;
    return {
      ...b,
      ...(o.weight !== undefined && { weight: o.weight }),
      ...(b.match && o.match && { match: o.match }),
    };
  });
}

/** A match with the CRD's defaults filled in, so two can be compared. */
/**
 * A match's path as the controller reads it: a prefix without its trailing
 * slash, and none for the "/" prefix, which selects every request.
 */
function pathOf(
  m: EndpointBackendMatch,
): { type: 'PathPrefix' | 'Exact'; value: string } | undefined {
  if (!m.path) return undefined;
  const type = m.path.type ?? 'PathPrefix';
  let value = m.path.value;
  if (type === 'PathPrefix' && value.length > 1 && value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return type === 'PathPrefix' && value === '/' ? undefined : { type, value };
}

function normalMatch(m: EndpointBackendMatch): EndpointBackendMatch {
  const path = pathOf(m);
  return {
    ...(path && { path }),
    ...(m.headers?.length && {
      headers: m.headers
        .map(h => ({
          name: h.name.toLowerCase(),
          type: h.type ?? 'Exact',
          value: h.value,
        }))
        .sort((x, y) => x.name.localeCompare(y.name)),
    }),
    ...(m.cookies?.length && {
      cookies: m.cookies.map(c => ({ name: c.name, value: c.value })),
    }),
  };
}

/** Whether two matches take the same requests. */
export function sameMatch(
  a: EndpointBackendMatch | undefined,
  b: EndpointBackendMatch | undefined,
): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(normalMatch(a)) === JSON.stringify(normalMatch(b));
}

/** Each backend's value as a percentage: its share, or a mirror's copy. */
export function splitOf(backends: EndpointTrafficBackend[]): EndpointSplit {
  const shared = backends.filter(b => !isMirror(b));
  const percents = splitPercents(shared.map(b => b.weight));
  const split: EndpointSplit = {};
  shared.forEach((b, i) => {
    split[b.name] = percents[i];
  });
  for (const b of backends) {
    if (b.mirror) split[b.name] = b.mirror.percent;
  }
  return split;
}

/** Whether two lists of weights split traffic the same way. */
export function sameRatio(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sumA = a.reduce((s, w) => s + w, 0);
  const sumB = b.reduce((s, w) => s + w, 0);
  if (sumA === 0 || sumB === 0) return sumA === sumB;
  return a.every((w, i) => w * sumB === b[i] * sumA);
}

/**
 * A backend as the portal lists it, `trips / http` or
 * `trips @ go-rewrite / http`, so a message never reads as the whole component.
 */
export const backendLabel = (
  b: Pick<EndpointTrafficBackend, 'componentName' | 'releaseLine' | 'endpoint'>,
) =>
  `${b.componentName}${b.releaseLine ? ` @ ${b.releaseLine}` : ''} / ${
    b.endpoint
  }`;

/** The label of the backend named `name` among `backends`, or the name. */
export const labelOf = (backends: EndpointTrafficBackend[], name: string) => {
  const b = backends.find(x => x.name === name);
  return b ? backendLabel(b) : name;
};

/** A split's value for a backend, read only from the split's own keys. */
const valueIn = (split: EndpointSplit, name: string) =>
  Object.prototype.hasOwnProperty.call(split, name) ? split[name] : undefined;

/**
 * Why a split can't be saved, or '' when it can: every value is a whole
 * percentage, and the shares cover every backend that takes one and add up
 * to 100, so requests no condition takes always have somewhere to go.
 */
export function splitProblem(
  backends: EndpointTrafficBackend[],
  split: EndpointSplit,
): string {
  const has = (name: string) => valueIn(split, name) !== undefined;
  const unknown = Object.keys(split).filter(
    name => !backends.some(b => b.name === name),
  );
  if (unknown.length > 0) return `No backend named ${unknown.join(', ')}`;
  for (const [name, v] of Object.entries(split)) {
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return `${labelOf(
        backends,
        name,
      )}: give a whole percentage from 0 to 100`;
    }
  }
  const shared = backends.filter(b => !isMirror(b));
  if (shared.length === 0) return '';
  const missing = shared.filter(b => !has(b.name));
  if (missing.length > 0) {
    return `Give a share for ${missing.map(backendLabel).join(', ')}`;
  }
  const total = shared.reduce((s, b) => s + split[b.name], 0);
  if (total > 100)
    return `Total ${total}%. Take ${total - 100}% off a backend.`;
  if (total < 100) return `Total ${total}%. Add ${100 - total}% to a backend.`;
  return '';
}

/**
 * An environment's overrides for a split and its own conditions. Shares that
 * keep the release's ratio, copies and conditions that match the release
 * store nothing, so an environment differs from the release only where it
 * really does. A condition is kept only for a backend that has one in the
 * release.
 */
export function overridesFor(
  release: EndpointTrafficBackend[],
  split: EndpointSplit,
  matches: Record<string, EndpointBackendMatch> = {},
): EndpointTrafficOverride[] {
  const shared = release.filter(b => !isMirror(b));
  const picked = shared.map(b => valueIn(split, b.name) ?? b.weight);
  const sameShares = sameRatio(
    shared.map(b => b.weight),
    picked,
  );
  const out: EndpointTrafficOverride[] = [];
  for (const b of release) {
    const v = valueIn(split, b.name);
    if (b.mirror) {
      if (v !== undefined && v !== b.mirror.percent) {
        out.push({ name: b.name, mirror: { percent: v } });
      }
    } else {
      const m = matches[b.name];
      const ownMatch = b.match && m && !sameMatch(m, b.match) ? m : undefined;
      if (!sameShares || ownMatch) {
        out.push({
          name: b.name,
          ...(!sameShares && { weight: v ?? b.weight }),
          ...(ownMatch && { match: ownMatch }),
        });
      }
    }
  }
  return out;
}

/** An environment's own conditions, by backend name, for backends that have one in the release. */
export function ownMatches(
  release: EndpointTrafficBackend[],
  overrides: EndpointTrafficOverride[],
): Record<string, EndpointBackendMatch> {
  const out: Record<string, EndpointBackendMatch> = {};
  for (const o of overrides) {
    const b = release.find(x => x.name === o.name);
    if (o.match && b?.match && !isMirror(b)) out[o.name] = o.match;
  }
  return out;
}

/**
 * The overrides an environment keeps when it runs `release`. An own split
 * that gave a share to a backend the release no longer has is dropped, so
 * the environment follows the release's split instead of a remnant of a
 * split built around that backend; entries for backends the release lacks
 * go, so a backend added later under the same name starts fresh; and an own
 * split that equals the release's, or would route nothing, is dropped. Its
 * own conditions stay for each backend that still has a condition in the
 * release, whatever happens to the split.
 */
export function keptOverrides(
  release: EndpointTrafficBackend[],
  overrides: EndpointTrafficOverride[],
  /** A backend with a share left in another way, such as by being retargeted. */
  shareLeft = false,
): EndpointTrafficOverride[] {
  const heeded = heededOverrides(overrides, release);
  const matches = ownMatches(release, heeded);
  const lostShare =
    shareLeft ||
    overrides.some(o => !heeded.includes(o) && (o.weight ?? 0) > 0);
  const own = effectiveBackends(release, heeded);
  const keepSplit =
    !lostShare &&
    heeded.some(o => o.weight !== undefined || o.mirror) &&
    own.some(b => !isMirror(b) && b.weight > 0);
  // A mirror's copy share doesn't depend on the shares, so it stays even
  // when the split goes.
  const copies = Object.fromEntries(
    own.filter(isMirror).map(b => [b.name, b.mirror!.percent]),
  );
  return overridesFor(
    release,
    keepSplit
      ? Object.fromEntries(
          own.map(b => [b.name, b.mirror ? b.mirror.percent : b.weight]),
        )
      : copies,
    matches,
  );
}

/**
 * The overrides an environment keeps on the release it already runs: only
 * what changes nothing goes, so its traffic doesn't move. Entries for
 * backends the release lacks, which the controller ignores, go, and so does
 * an own split equal to the release's. Undefined when the own split routes
 * nothing, which the controller already refuses to apply.
 */
export function prunedOverrides(
  release: EndpointTrafficBackend[],
  overrides: EndpointTrafficOverride[],
): EndpointTrafficOverride[] | undefined {
  const heeded = heededOverrides(overrides, release);
  const own = effectiveBackends(release, heeded);
  const split = heeded.some(o => o.weight !== undefined || o.mirror);
  if (split && !own.some(b => !isMirror(b) && b.weight > 0)) return undefined;
  return overridesFor(
    release,
    split
      ? Object.fromEntries(
          own.map(b => [b.name, b.mirror ? b.mirror.percent : b.weight]),
        )
      : {},
    ownMatches(release, heeded),
  );
}

/** Whether two backends route to the same component, endpoint and release line. */
export const sameTarget = (
  a: EndpointTrafficBackend,
  b: EndpointTrafficBackend,
) =>
  a.componentName === b.componentName &&
  a.endpoint === b.endpoint &&
  (a.releaseLine ?? '') === (b.releaseLine ?? '');

/** The overrides naming one of the backends; the controller ignores the rest. */
export function heededOverrides<T extends { name: string }>(
  overrides: T[],
  backends: { name: string }[],
): T[] {
  return overrides.filter(o => backends.some(b => b.name === o.name));
}

const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const COOKIE_VALUE = /^[A-Za-z0-9_.-]{1,128}$/;
/** A header name as the CRD accepts it (an HTTP token). */
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;

/**
 * Checks a backend's match the way the CRD and the Endpoint webhook do, so
 * the portal and its backend refuse a bad one with a readable message
 * instead of an admission error. An empty list means the match is valid.
 */
export function backendMatchProblems(match: EndpointBackendMatch): string[] {
  const problems: string[] = [];
  // A request body can carry anything; refuse what isn't a match readably.
  const raw = match as unknown as Record<string, unknown>;
  const text = (v: unknown) => typeof v === 'string';
  const entries = (v: unknown) => v === undefined || Array.isArray(v);
  if (
    !entries(raw.headers) ||
    !entries(raw.cookies) ||
    (raw.path !== undefined &&
      !text((raw.path as Record<string, unknown> | null)?.value))
  ) {
    return ['A match takes a path, a list of headers and a list of cookies'];
  }
  const shaped = (v: unknown) =>
    typeof v === 'object' &&
    v !== null &&
    text((v as Record<string, unknown>).name) &&
    text((v as Record<string, unknown>).value);
  if (![...(match.headers ?? []), ...(match.cookies ?? [])].every(shaped)) {
    return ['Each header and cookie takes a name and a value'];
  }
  const { path, headers = [], cookies = [] } = match;
  if (!path && headers.length === 0 && cookies.length === 0) {
    problems.push('Add a header, cookie or path');
  }
  if (path) {
    if (!/^\/[^?#]*$/.test(path.value)) {
      problems.push(`Path ${path.value} must start with / and have no ? or #`);
    } else if (
      path.value.includes('//') ||
      path.value
        .split('/')
        .slice(1)
        .some(s => s === '.' || s === '..')
    ) {
      problems.push(`Path ${path.value} must not contain //, . or ..`);
    }
  }
  if (headers.length > 8) problems.push('At most 8 headers');
  const seen = new Set<string>();
  for (const h of headers) {
    const name = h.name.toLowerCase();
    if (!HEADER_NAME.test(h.name)) {
      problems.push(`Header name "${h.name}" is not a valid HTTP header name`);
    }
    if (!h.value) problems.push(`Give a value for ${h.name}`);
    if (seen.has(name)) problems.push(`Header ${h.name} is matched twice`);
    seen.add(name);
    if (name === 'cookie' && cookies.length > 0) {
      problems.push(
        'Match the cookie as a cookie or as the Cookie header, not both',
      );
    }
  }
  if (cookies.length > 1) problems.push('At most one cookie');
  for (const c of cookies) {
    if (!COOKIE_NAME.test(c.name) || !COOKIE_VALUE.test(c.value)) {
      problems.push(
        `Cookie ${c.name}=${c.value} uses characters a cookie match can't`,
      );
    }
  }
  return problems;
}

const canonical = (m: EndpointBackendMatch) =>
  JSON.stringify({
    path: pathOf(m),
    headers: [...(m.headers ?? [])]
      .map(h => ({
        name: h.name.toLowerCase(),
        type: h.type ?? 'Exact',
        value: h.value,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    cookies: (m.cookies ?? []).map(c => ({ name: c.name, value: c.value })),
  });

/**
 * Why a backend's match can't be saved among the others, or '': it must be
 * valid, and no other backend may have the same one, since only the first
 * would ever get those requests.
 */
export function matchProblem(
  backends: EndpointTrafficBackend[],
  name: string,
  match: EndpointBackendMatch,
): string {
  const problems = backendMatchProblems(match);
  if (problems.length > 0) return problems[0];
  const twin = backends.find(
    b => b.name !== name && b.match && canonical(b.match) === canonical(match),
  );
  return twin
    ? `${twin.name} already gets the requests that meet these conditions`
    : '';
}

/** One line describing a match, e.g. "header x-preview: true". */
export function describeMatch(match: EndpointBackendMatch): string {
  const parts: string[] = [];
  if (match.path) {
    parts.push(
      `path ${match.path.type === 'Exact' ? '= ' : ''}${match.path.value}`,
    );
  }
  for (const h of match.headers ?? []) {
    parts.push(
      `header ${h.name}${h.type === 'RegularExpression' ? ' ~ ' : ': '}${
        h.value
      }`,
    );
  }
  for (const c of match.cookies ?? []) {
    parts.push(`cookie ${c.name}=${c.value}`);
  }
  return parts.join(' and ');
}

/** A name as the Endpoint accepts it: a lowercase DNS label of up to 63 characters. */
function toLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}

/**
 * A backend name for a new workload endpoint that no other backend has: the
 * component and release line, then its endpoint, then a number.
 */
export function uniqueBackendName(
  backends: Array<{ name: string }>,
  target: { componentName: string; endpoint: string; releaseLine?: string },
): string {
  const used = new Set(backends.map(b => b.name));
  const base = toLabel(
    target.releaseLine
      ? `${target.componentName}-${target.releaseLine}`
      : target.componentName,
  );
  if (!used.has(base)) return base;
  const withEndpoint = toLabel(`${base}-${target.endpoint}`);
  if (!used.has(withEndpoint)) return withEndpoint;
  for (let i = 2; ; i++) {
    const numbered = toLabel(`${withEndpoint.slice(0, 60)}-${i}`);
    if (!used.has(numbered)) return numbered;
  }
}

/**
 * Whether match a is checked before match b. OpenChoreo ranks matches as
 * Gateway API does, so every mesh picks the same backend: an exact path,
 * then the longer path (no path, or the "/" prefix, ranks below every
 * other path), then more headers
 * and cookies. Equal matches keep their order in the list.
 */
export function moreSpecific(
  a: EndpointBackendMatch,
  b: EndpointBackendMatch,
): boolean {
  const exact = (m: EndpointBackendMatch) => pathOf(m)?.type === 'Exact';
  if (exact(a) !== exact(b)) return exact(a);
  const length = (m: EndpointBackendMatch) => pathOf(m)?.value.length ?? 0;
  if (length(a) !== length(b)) return length(a) > length(b);
  const conditions = (m: EndpointBackendMatch) =>
    (m.headers?.length ?? 0) + (m.cookies?.length ?? 0);
  return conditions(a) > conditions(b);
}

/** Backends with a match in the order they are checked, then the rest as listed. */
export function inMatchOrder<T extends { match?: EndpointBackendMatch }>(
  backends: T[],
): T[] {
  const matched = backends.filter(b => b.match);
  const ordered = matched
    .map((b, i) => ({ b, i }))
    .sort((x, y) => {
      if (moreSpecific(x.b.match!, y.b.match!)) return -1;
      if (moreSpecific(y.b.match!, x.b.match!)) return 1;
      return x.i - y.i;
    })
    .map(x => x.b);
  return [...ordered, ...backends.filter(b => !b.match)];
}

/**
 * What the backends use that a type with these capabilities can't render,
 * as the controller checks it; empty when nothing is missing or the type
 * declares nothing.
 */
export function capabilityProblems(
  backends: EndpointTrafficBackend[],
  capabilities: EndpointCapability[] | undefined,
): string[] {
  if (!capabilities) return [];
  const problems: string[] = [];
  const need = (c: EndpointCapability, name: string, what: string) => {
    if (capabilities.includes(c)) return true;
    problems.push(`${name}: ${what} needs the ${c} capability`);
    return false;
  };
  for (const b of backends) {
    if (b.match && need('Match', b.name, 'a condition')) {
      if (b.match.cookies?.length) {
        need('RegularExpression', b.name, 'a cookie condition');
      } else if (b.match.headers?.some(h => h.type === 'RegularExpression')) {
        need('RegularExpression', b.name, 'a regular expression header');
      }
    }
    if (
      b.mirror &&
      need('Mirror', b.name, 'a mirror') &&
      b.mirror.percent > 0 &&
      b.mirror.percent < 100
    ) {
      need('MirrorPercent', b.name, 'mirroring a share of requests');
    }
  }
  return problems;
}
