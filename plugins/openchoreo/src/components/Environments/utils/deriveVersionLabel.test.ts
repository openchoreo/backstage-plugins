import { deriveVersionLabel } from './deriveVersionLabel';

describe('deriveVersionLabel', () => {
  it('returns undefined when image is missing or empty', () => {
    expect(deriveVersionLabel(undefined)).toBeUndefined();
    expect(deriveVersionLabel('')).toBeUndefined();
    expect(deriveVersionLabel('   ')).toBeUndefined();
  });

  it('returns the tag after the last colon for tagged images', () => {
    expect(deriveVersionLabel('nginx:1.27')).toBe('1.27');
    expect(deriveVersionLabel('gcr.io/foo/bar:v3.0.9')).toBe('v3.0.9');
    expect(deriveVersionLabel('registry.local:5000/team/app:abc1234')).toBe(
      'abc1234',
    );
  });

  it('returns a short digest for digest-pinned images', () => {
    expect(
      deriveVersionLabel(
        'gcr.io/foo/bar@sha256:deadbeefcafebabedeadbeefcafebabe',
      ),
    ).toBe('sha256:deadbee');
  });

  it('returns undefined for an image with no tag and no digest', () => {
    expect(deriveVersionLabel('nginx')).toBeUndefined();
    expect(deriveVersionLabel('gcr.io/foo/bar')).toBeUndefined();
  });
});
