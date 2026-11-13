/** The most backends an Endpoint takes, as the Endpoint CRD allows. */
export const MAX_ENDPOINT_BACKENDS = 16;

/** The largest backend weight the Endpoint CRD accepts. */
export const MAX_ENDPOINT_BACKEND_WEIGHT = 1_000_000;

/** Whether a value is a backend weight the Endpoint CRD accepts. */
export function isEndpointBackendWeight(weight: unknown): weight is number {
  return (
    typeof weight === 'number' &&
    Number.isInteger(weight) &&
    weight >= 0 &&
    weight <= MAX_ENDPOINT_BACKEND_WEIGHT
  );
}

/**
 * Derives a backend's name from its component and workload endpoint, made
 * unique among the taken names. Backend names key the Endpoint's backendRefs.
 */
export function deriveEndpointBackendName(
  component: string,
  endpoint: string,
  taken: Iterable<string>,
): string {
  const used = new Set(taken);
  const base = `${component}-${endpoint}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    // Cut before trimming, so a cut just after a hyphen can't leave the name
    // ending in one.
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  let name = base;
  for (let i = 2; used.has(name); i++) {
    name = `${base}-${i}`;
  }
  return name;
}

/**
 * Whether backends with these weights send traffic anywhere. A missing weight
 * defaults to 1 on the Endpoint.
 */
export function endpointBackendsTakeTraffic(
  backends: { weight?: number }[],
): boolean {
  return backends.some(b => b.weight === undefined || b.weight > 0);
}
