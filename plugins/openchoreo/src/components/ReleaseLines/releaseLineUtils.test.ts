import {
  parseReleaseLineYaml,
  pickOverridableProperties,
  toEditableReleaseLine,
  validateReleaseLineName,
} from './releaseLineUtils';

describe('validateReleaseLineName', () => {
  it.each(['main', 'next', 'v2', 'release-1-2'])('accepts %s', name => {
    expect(validateReleaseLineName(name)).toBeUndefined();
  });

  it.each(['', 'Main', '-next', 'next-', 'feature/x', 'a'.repeat(64)])(
    'rejects %j',
    name => {
      expect(validateReleaseLineName(name)).toBeDefined();
    },
  );
});

describe('pickOverridableProperties', () => {
  it('keeps only the properties a release line can override', () => {
    expect(
      pickOverridableProperties({
        owner: { projectName: 'default', componentName: 'hello' },
        componentType: { kind: 'ClusterComponentType', name: 'service' },
        autoDeploy: true,
        parameters: { logLevel: 'info' },
        traits: [],
        workflow: { name: 'builder', parameters: { a: 1 } },
      }),
    ).toEqual({
      autoDeploy: true,
      parameters: { logLevel: 'info' },
      traits: [],
      workflow: { parameters: { a: 1 } },
    });
  });

  it('returns nothing for a missing spec', () => {
    expect(pickOverridableProperties(undefined)).toEqual({});
  });
});

const current = {
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind: 'ReleaseLine',
  metadata: {
    name: 'next',
    namespace: 'default',
    uid: 'abc',
    resourceVersion: '42',
    creationTimestamp: '2026-10-01T00:00:00Z',
  },
  spec: {
    owner: { projectName: 'default', componentName: 'hello' },
    parameters: { logLevel: 'warn' },
  },
  status: { latestRelease: { name: 'hello-next-1' } },
};

describe('toEditableReleaseLine', () => {
  it('leaves out server-managed metadata and the status', () => {
    expect(toEditableReleaseLine(current)).toEqual({
      apiVersion: 'openchoreo.dev/v1alpha1',
      kind: 'ReleaseLine',
      metadata: { name: 'next', namespace: 'default' },
      spec: current.spec,
    });
  });
});

describe('parseReleaseLineYaml', () => {
  const edited = (changes: Record<string, unknown>) => ({
    ...toEditableReleaseLine(current),
    ...changes,
  });

  it('accepts a new description and overrides', () => {
    expect(
      parseReleaseLineYaml(
        edited({
          metadata: {
            name: 'next',
            annotations: { 'openchoreo.dev/description': 'Next branch' },
          },
          spec: {
            owner: { projectName: 'default', componentName: 'hello' },
            autoDeploy: false,
            workflow: { parameters: { branch: 'next' } },
          },
        }),
        current,
      ),
    ).toEqual({
      apiVersion: 'openchoreo.dev/v1alpha1',
      kind: 'ReleaseLine',
      metadata: {
        name: 'next',
        namespace: 'default',
        annotations: { 'openchoreo.dev/description': 'Next branch' },
      },
      spec: {
        owner: { projectName: 'default', componentName: 'hello' },
        autoDeploy: false,
        workflow: { parameters: { branch: 'next' } },
      },
    });
  });

  it('keeps the owner when the edit leaves it out', () => {
    const parsed = parseReleaseLineYaml(
      edited({ spec: { parameters: { logLevel: 'info' } } }),
      current,
    );
    expect(parsed.spec?.owner).toEqual(current.spec.owner);
  });

  it.each([
    ['a rename', { metadata: { name: 'other' } }, /cannot be renamed/],
    ['another kind', { kind: 'Component' }, /kind must be ReleaseLine/],
    [
      'another owner',
      {
        spec: { owner: { projectName: 'default', componentName: 'other' } },
      },
      /spec.owner cannot change/,
    ],
    [
      'an inherited property',
      { spec: { componentType: { name: 'x' } } },
      /componentType/,
    ],
    [
      'a non-string annotation',
      { metadata: { name: 'next', annotations: { a: 1 } } },
      /annotations must map names to strings/,
    ],
    [
      'other workflow fields',
      { spec: { workflow: { name: 'builder' } } },
      /workflow can only set parameters/,
    ],
  ])('rejects %s', (_label, changes, message) => {
    expect(() => parseReleaseLineYaml(edited(changes), current)).toThrow(
      message,
    );
  });

  it('rejects content that is not a mapping', () => {
    expect(() => parseReleaseLineYaml(['a'], current)).toThrow('mapping');
  });
});
