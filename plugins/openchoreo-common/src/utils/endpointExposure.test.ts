import { endpointProtocol } from './endpointExposure';

describe('endpointProtocol', () => {
  it('prefers protocol and falls back to the deprecated type', () => {
    expect(endpointProtocol({ protocol: 'gRPC', type: 'HTTP' })).toBe('gRPC');
    expect(endpointProtocol({ type: 'HTTP' })).toBe('HTTP');
    expect(endpointProtocol({})).toBe('');
  });
});
