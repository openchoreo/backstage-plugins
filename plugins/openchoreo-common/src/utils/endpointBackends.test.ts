import {
  deriveEndpointBackendName,
  endpointBackendsTakeTraffic,
  isEndpointBackendWeight,
} from './endpointBackends';

describe('deriveEndpointBackendName', () => {
  it('names a backend after its component and endpoint, uniquely', () => {
    expect(deriveEndpointBackendName('orders', 'http', [])).toBe('orders-http');
    expect(deriveEndpointBackendName('orders', 'http', ['orders-http'])).toBe(
      'orders-http-2',
    );
    expect(deriveEndpointBackendName('Orders', 'HTTP_v2', [])).toBe(
      'orders-http-v2',
    );
  });

  it('never ends a long name with a hyphen', () => {
    // The 60-character cut falls just after the hyphen.
    const name = deriveEndpointBackendName('a'.repeat(59), 'b', []);
    expect(name).toBe('a'.repeat(59));
    expect(name).toMatch(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
  });
});

describe('isEndpointBackendWeight', () => {
  it('accepts whole numbers from 0 to 1,000,000', () => {
    expect(isEndpointBackendWeight(0)).toBe(true);
    expect(isEndpointBackendWeight(1_000_000)).toBe(true);
    expect(isEndpointBackendWeight(-1)).toBe(false);
    expect(isEndpointBackendWeight(1_000_001)).toBe(false);
    expect(isEndpointBackendWeight(1.5)).toBe(false);
    expect(isEndpointBackendWeight('1')).toBe(false);
  });
});

describe('endpointBackendsTakeTraffic', () => {
  it('needs one backend with a weight above 0, counting a missing weight as 1', () => {
    expect(endpointBackendsTakeTraffic([{ weight: 0 }, { weight: 0 }])).toBe(
      false,
    );
    expect(endpointBackendsTakeTraffic([{ weight: 0 }, { weight: 2 }])).toBe(
      true,
    );
    expect(endpointBackendsTakeTraffic([{ weight: 0 }, {}])).toBe(true);
  });
});
