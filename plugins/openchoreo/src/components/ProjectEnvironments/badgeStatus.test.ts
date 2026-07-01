import { deriveProjectEnvBadgeStatus } from './badgeStatus';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';

const base: ProjectEnvironment = { name: 'dev' };

describe('deriveProjectEnvBadgeStatus', () => {
  it('returns not-deployed when there is no binding', () => {
    expect(deriveProjectEnvBadgeStatus(base)).toBe('not-deployed');
  });

  it('maps a Ready binding to active', () => {
    expect(
      deriveProjectEnvBadgeStatus({
        ...base,
        bindingName: 'b',
        status: 'Ready',
      }),
    ).toBe('active');
  });

  it('maps a Failed binding to failed', () => {
    expect(
      deriveProjectEnvBadgeStatus({
        ...base,
        bindingName: 'b',
        status: 'Failed',
      }),
    ).toBe('failed');
  });

  it('maps a NotReady binding to pending', () => {
    expect(
      deriveProjectEnvBadgeStatus({
        ...base,
        bindingName: 'b',
        status: 'NotReady',
      }),
    ).toBe('pending');
  });

  it('falls back to unknown for a bound env with no status', () => {
    expect(deriveProjectEnvBadgeStatus({ ...base, bindingName: 'b' })).toBe(
      'unknown',
    );
  });
});
