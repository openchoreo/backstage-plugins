import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import {
  mergeEnvVarsWithStatus,
  getBaseEnvVarsForContainer,
  formatEnvVarValue,
} from './envVarUtils';

describe('mergeEnvVarsWithStatus', () => {
  it('returns all as inherited when no overrides', () => {
    const base: EnvVar[] = [
      { key: 'PORT', value: '8080' },
      { key: 'HOST', value: 'localhost' },
    ];
    const result = mergeEnvVarsWithStatus(base, []);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ envVar: base[0], status: 'inherited' });
    expect(result[1]).toEqual({ envVar: base[1], status: 'inherited' });
  });

  it('marks overridden vars with correct status, baseValue, and actualIndex', () => {
    const base: EnvVar[] = [{ key: 'PORT', value: '8080' }];
    const override: EnvVar[] = [{ key: 'PORT', value: '3000' }];
    const result = mergeEnvVarsWithStatus(base, override);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('overridden');
    expect(result[0].envVar.value).toBe('3000');
    expect(result[0].baseValue?.value).toBe('8080');
    expect(result[0].actualIndex).toBe(0);
  });

  it('marks new override vars', () => {
    const base: EnvVar[] = [];
    const override: EnvVar[] = [{ key: 'NEW_VAR', value: 'hello' }];
    const result = mergeEnvVarsWithStatus(base, override);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('new');
    expect(result[0].envVar.key).toBe('NEW_VAR');
    expect(result[0].actualIndex).toBe(0);
  });

  it('handles mixed inherited, overridden, and new', () => {
    const base: EnvVar[] = [
      { key: 'KEEP', value: 'a' },
      { key: 'CHANGE', value: 'b' },
    ];
    const override: EnvVar[] = [
      { key: 'CHANGE', value: 'b2' },
      { key: 'ADD', value: 'c' },
    ];
    const result = mergeEnvVarsWithStatus(base, override);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ envVar: base[0], status: 'inherited' });
    expect(result[1].status).toBe('overridden');
    expect(result[1].envVar.value).toBe('b2');
    expect(result[2].status).toBe('new');
    expect(result[2].envVar.key).toBe('ADD');
  });

  it('returns empty for both empty', () => {
    expect(mergeEnvVarsWithStatus([], [])).toEqual([]);
  });
});

describe('getBaseEnvVarsForContainer', () => {
  it('returns env vars from workload container', () => {
    const workload = {
      container: { env: [{ key: 'A', value: '1' }] },
    } as any;
    expect(getBaseEnvVarsForContainer(workload)).toEqual([
      { key: 'A', value: '1' },
    ]);
  });

  it('returns empty array for null workload', () => {
    expect(getBaseEnvVarsForContainer(null)).toEqual([]);
  });

  it('returns empty array when container has no env', () => {
    expect(getBaseEnvVarsForContainer({ container: {} } as any)).toEqual([]);
  });
});

describe('formatEnvVarValue', () => {
  it('returns plain value', () => {
    expect(formatEnvVarValue({ key: 'PORT', value: '8080' })).toBe('8080');
  });

  it('formats secret references', () => {
    const envVar: EnvVar = {
      key: 'DB_PASS',
      valueFrom: { secretKeyRef: { name: 'db-creds', key: 'password' } },
    };
    expect(formatEnvVarValue(envVar)).toBe('Secret: db-creds/password');
  });

  it('masks sensitive keys containing "secret"', () => {
    expect(formatEnvVarValue({ key: 'MY_SECRET', value: 'supersecret' })).toBe(
      '••••••••',
    );
  });

  it('masks sensitive keys containing "password"', () => {
    expect(formatEnvVarValue({ key: 'DB_PASSWORD', value: 'pass123' })).toBe(
      '••••••••',
    );
  });

  it('masks sensitive keys containing "token"', () => {
    expect(formatEnvVarValue({ key: 'API_TOKEN', value: 'tok123' })).toBe(
      '••••••••',
    );
  });

  it('masks sensitive keys containing "key"', () => {
    expect(formatEnvVarValue({ key: 'API_KEY', value: 'k123' })).toBe(
      '••••••••',
    );
  });

  it('does not mask sensitive key with empty value', () => {
    expect(formatEnvVarValue({ key: 'API_KEY', value: '' })).toBe('');
  });

  it('returns empty string for undefined value', () => {
    expect(formatEnvVarValue({ key: 'EMPTY' })).toBe('');
  });
});
