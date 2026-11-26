import {
  componentPath,
  grantsUnconditionally,
  mayGrant,
  namespacePath,
  projectPath,
} from './capabilities';

const path = componentPath('acme', 'payments', 'api');
const action = 'releasebinding:view';

describe('authz paths', () => {
  it('builds them the way OpenChoreo does', () => {
    expect(namespacePath('acme')).toBe('ns/acme');
    expect(projectPath('acme', 'payments')).toBe('ns/acme/project/payments');
    expect(path).toBe('ns/acme/project/payments/component/api');
  });
});

describe('grantsUnconditionally', () => {
  it.each([
    ['a cluster-wide grant', { [action]: { allowed: [{ path: '*' }] } }],
    ['a namespace grant', { [action]: { allowed: [{ path: 'ns/acme' }] } }],
    [
      'a project grant',
      { [action]: { allowed: [{ path: 'ns/acme/project/payments' }] } },
    ],
    ['a grant on the component itself', { [action]: { allowed: [{ path }] } }],
    [
      'the single entry of a control plane with authorization off',
      { '*': { allowed: [{ path: '*' }], denied: [] } },
    ],
  ])('accepts %s', (_label, capabilities) => {
    expect(grantsUnconditionally(capabilities, action, path)).toBe(true);
  });

  it.each([
    [
      'no entry for the action',
      { 'component:view': { allowed: [{ path: '*' }] } },
    ],
    [
      'a grant on another project',
      { [action]: { allowed: [{ path: 'ns/acme/project/billing' }] } },
    ],
    [
      'a grant on a project whose name starts the same',
      { [action]: { allowed: [{ path: 'ns/acme/project/pay' }] } },
    ],
    [
      'a grant limited by a CEL condition',
      {
        [action]: {
          allowed: [
            {
              path: '*',
              constraints: { expressions: ['resource.environment == "dev"'] },
            },
          ],
        },
      },
    ],
    [
      'a denial above the component',
      {
        [action]: {
          allowed: [{ path: '*' }],
          denied: [{ path: 'ns/acme/project/payments' }],
        },
      },
    ],
    [
      'a denial on the namespace',
      {
        [action]: {
          allowed: [{ path: '*' }],
          denied: [{ path: 'ns/acme' }],
        },
      },
    ],
    [
      'a denial below the component',
      {
        [action]: {
          allowed: [{ path: '*' }],
          denied: [{ path: `${path}/something` }],
        },
      },
    ],
  ])('refuses %s', (_label, capabilities) => {
    expect(grantsUnconditionally(capabilities, action, path)).toBe(false);
  });

  it('refuses a namespace path to a grant on a project inside it', () => {
    expect(
      grantsUnconditionally(
        {
          'environment:view': {
            allowed: [{ path: 'ns/acme/project/payments' }],
          },
        },
        'environment:view',
        namespacePath('acme'),
      ),
    ).toBe(false);
  });
});

describe('mayGrant', () => {
  const cel = { expressions: ['resource.releaseLine == "main"'] };

  it.each([
    ['a cluster-wide grant', { [action]: { allowed: [{ path: '*' }] } }],
    [
      'a grant limited by a CEL condition',
      { [action]: { allowed: [{ path: '*', constraints: cel }] } },
    ],
    [
      'a denial below the component',
      {
        [action]: {
          allowed: [{ path: '*' }],
          denied: [{ path: `${path}/something` }],
        },
      },
    ],
    [
      'a denial limited by a CEL condition',
      {
        [action]: {
          allowed: [{ path: '*' }],
          denied: [{ path: 'ns/acme', constraints: cel }],
        },
      },
    ],
  ])('accepts %s', (_label, capabilities) => {
    expect(mayGrant(capabilities, action, path)).toBe(true);
  });

  it.each([
    [
      'no entry for the action',
      { 'component:view': { allowed: [{ path: '*' }] } },
    ],
    [
      'a grant on another project',
      { [action]: { allowed: [{ path: 'ns/acme/project/billing' }] } },
    ],
    [
      'a denial above the component',
      {
        [action]: {
          allowed: [{ path: '*' }],
          denied: [{ path: 'ns/acme/project/payments' }],
        },
      },
    ],
  ])('refuses %s', (_label, capabilities) => {
    expect(mayGrant(capabilities, action, path)).toBe(false);
  });
});
