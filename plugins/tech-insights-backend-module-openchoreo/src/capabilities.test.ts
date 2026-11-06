import { componentPath, grantsUnconditionally } from './capabilities';

const path = componentPath('acme', 'payments', 'api');
const action = 'releasebinding:view';

describe('grantsUnconditionally', () => {
  it.each([
    ['a cluster-wide grant', { [action]: { allowed: [{ path: '*' }] } }],
    [
      'a namespace grant',
      { [action]: { allowed: [{ path: 'namespace/acme' }] } },
    ],
    ['a grant on the component itself', { [action]: { allowed: [{ path }] } }],
    [
      'the single entry of a control plane with authorization off',
      { '*': { allowed: [{ path: '*' }], denied: [] } },
    ],
    [
      'a wildcard over the resource kind',
      { 'releasebinding:*': { allowed: [{ path: '*' }] } },
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
      { [action]: { allowed: [{ path: 'namespace/acme/project/billing' }] } },
    ],
    [
      'a grant on a project whose name starts the same',
      { [action]: { allowed: [{ path: 'namespace/acme/project/pay' }] } },
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
          denied: [{ path: 'namespace/acme/project/payments' }],
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
});
