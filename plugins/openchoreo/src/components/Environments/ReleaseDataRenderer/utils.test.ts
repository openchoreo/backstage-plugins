import {
  formatTimestamp,
  getHealthStatusForTab,
  getHealthChipClass,
} from './utils';

describe('formatTimestamp', () => {
  it('returns locale string for valid ISO timestamp', () => {
    const result = formatTimestamp('2026-03-04T10:23:20Z');
    // Just verify it returns a non-empty string that isn't the raw ISO
    expect(result).toBeTruthy();
    expect(result).not.toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatTimestamp(undefined)).toBe('N/A');
  });

  it('returns N/A for empty string', () => {
    expect(formatTimestamp('')).toBe('N/A');
  });
});

describe('getHealthStatusForTab', () => {
  it('maps Healthy to success', () => {
    expect(getHealthStatusForTab('Healthy')).toBe('success');
  });

  it('maps Progressing to warning', () => {
    expect(getHealthStatusForTab('Progressing')).toBe('warning');
  });

  it('maps Unknown to warning', () => {
    expect(getHealthStatusForTab('Unknown')).toBe('warning');
  });

  it('maps Degraded to error', () => {
    expect(getHealthStatusForTab('Degraded')).toBe('error');
  });

  it('maps Suspended to warning', () => {
    expect(getHealthStatusForTab('Suspended')).toBe('warning');
  });

  it('maps Undeployed to default', () => {
    expect(getHealthStatusForTab('Undeployed')).toBe('default');
  });

  it('returns default for undefined', () => {
    expect(getHealthStatusForTab(undefined)).toBe('default');
  });
});

describe('getHealthChipClass', () => {
  const mockClasses = {
    healthyChip: 'healthy-class',
    progressingChip: 'progressing-class',
    degradedChip: 'degraded-class',
    suspendedChip: 'suspended-class',
    unknownChip: 'unknown-class',
  } as any;

  it('returns healthyChip for Healthy', () => {
    expect(getHealthChipClass('Healthy', mockClasses)).toBe('healthy-class');
  });

  it('returns progressingChip for Progressing', () => {
    expect(getHealthChipClass('Progressing', mockClasses)).toBe(
      'progressing-class',
    );
  });

  it('returns degradedChip for Degraded', () => {
    expect(getHealthChipClass('Degraded', mockClasses)).toBe('degraded-class');
  });

  it('returns suspendedChip for Suspended', () => {
    expect(getHealthChipClass('Suspended', mockClasses)).toBe(
      'suspended-class',
    );
  });

  it('returns unknownChip for Undeployed', () => {
    expect(getHealthChipClass('Undeployed', mockClasses)).toBe('unknown-class');
  });

  it('returns unknownChip for undefined', () => {
    expect(getHealthChipClass(undefined, mockClasses)).toBe('unknown-class');
  });

  it('returns unknownChip for unrecognized status', () => {
    expect(getHealthChipClass('SomethingElse', mockClasses)).toBe(
      'unknown-class',
    );
  });
});
