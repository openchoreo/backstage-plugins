import {
  CHOREO_LABELS,
  GENERIC_SECRET_TYPE_VALUE,
  GIT_SECRET_TYPE_VALUE,
} from './constants';

describe('secret category constants', () => {
  it('exposes the label key used to mark a SecretReference category', () => {
    expect(CHOREO_LABELS.SECRET_TYPE).toBe('openchoreo.dev/secret-type');
  });

  it('marks git credentials with the git-credentials value', () => {
    expect(GIT_SECRET_TYPE_VALUE).toBe('git-credentials');
  });

  it('marks general-purpose secrets with the generic value', () => {
    expect(GENERIC_SECRET_TYPE_VALUE).toBe('generic');
  });
});
