import YAML from 'yaml';
import {
  allowedSubjectTypes,
  bindingFromYaml,
  bindingToYaml,
  deriveBindingName,
  hookSetFromYaml,
  hookSetToYaml,
  initialParameters,
  newBinding,
  parameterRowsForHook,
  selectorsOutsideEnabledTo,
  validateHookBinding,
  validateHookSet,
  type HookBindingFormData,
  type HookOption,
} from './hookBindingValidation';

// The rules under test mirror the control plane's DeploymentPipeline
// webhook. If any of them drift, the form would submit a pipeline the API
// rejects, and the engineer would only learn about it from the scaffolder log.

const trivy: HookOption = {
  kind: 'ClusterHook',
  name: 'trivy-image-scan',
  parameters: [
    { name: 'image', from: '${deployment.workload.containers.main.image}' },
    { name: 'severity', default: 'CRITICAL' },
    {
      name: 'ignoreUnfixed',
      from: '${deployment.environment.isProduction}',
      overridable: true,
    },
    { name: 'ticket', required: true },
    { name: 'registry', value: 'harbor' },
  ],
  enabledTo: [{ kind: 'ClusterComponentType', name: 'service' }],
};

const base = (
  over: Partial<HookBindingFormData> = {},
): HookBindingFormData => ({
  name: 'image-scan',
  hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
  mode: 'Sync',
  onFailure: 'Block',
  timeout: '30m',
  retries: 1,
  appliesTo: [],
  parameters: { severity: 'HIGH', ticket: 'CHG-1' },
  ...over,
});

describe('parameter mapping', () => {
  it('classifies every source and marks only bindable rows editable', () => {
    const rows = parameterRowsForHook(trivy.parameters);
    expect(rows.map(r => [r.name, r.source, r.editable, r.mandatory])).toEqual([
      ['image', 'from', false, false],
      ['severity', 'default', true, false],
      ['ignoreUnfixed', 'from-overridable', true, false],
      ['ticket', 'required', true, true],
      ['registry', 'fixed', false, false],
    ]);
  });

  it('prefills defaults only, so the YAML documents the value in use', () => {
    expect(initialParameters(trivy.parameters)).toEqual({
      severity: 'CRITICAL',
    });
  });

  it('derives a DNS-safe binding name from the hook name', () => {
    expect(deriveBindingName('Trivy Image_Scan')).toBe('trivy-image-scan');
    expect(deriveBindingName('a'.repeat(50))).toHaveLength(40);
    expect(newBinding(trivy, 'postDeploy').onFailure).toBe('Ignore');
    expect(newBinding(trivy, 'preDeploy').onFailure).toBe('Block');
  });
});

describe('appliesTo against enabledTo', () => {
  const options = [
    { kind: 'ClusterComponentType' as const, name: 'service' },
    { kind: 'ClusterComponentType' as const, name: 'worker' },
    { kind: 'ComponentType' as const, name: 'service' },
  ];

  it('hides component types the hook is not enabled for', () => {
    expect(allowedSubjectTypes(options, trivy.enabledTo)).toEqual([
      { kind: 'ClusterComponentType', name: 'service' },
    ]);
  });

  it('offers everything when the hook has no enabledTo', () => {
    expect(allowedSubjectTypes(options, [])).toEqual(options);
  });

  it('flags selectors outside enabledTo, including a same-name namespaced kind', () => {
    expect(
      selectorsOutsideEnabledTo(
        [
          { kind: 'ClusterComponentType', name: 'service' },
          { kind: 'ComponentType', name: 'service' },
        ],
        trivy.enabledTo,
      ),
    ).toEqual([{ kind: 'ComponentType', name: 'service' }]);
  });
});

describe('validateHookBinding', () => {
  const names = ['image-scan'];

  it('accepts a complete Sync pre-deploy binding', () => {
    expect(validateHookBinding(base(), 'preDeploy', names, trivy)).toEqual([]);
  });

  it.each([
    ['', 'Binding name is required'],
    ['Image-Scan', 'lowercase alphanumeric'],
    ['1scan', 'starting with a letter'],
    ['a'.repeat(41), 'at most 40'],
  ])('rejects the name %p', (name, message) => {
    const errs = validateHookBinding(
      base({ name }),
      'preDeploy',
      [name],
      trivy,
    );
    expect(errs.join('\n')).toContain(message);
  });

  it('rejects a name shared across pre and post lists of one target', () => {
    const errs = validateHookBinding(
      base(),
      'preDeploy',
      ['image-scan', 'image-scan'],
      trivy,
    );
    expect(errs.join('\n')).toContain(
      'unique across pre-deploy and post-deploy',
    );
  });

  it('rejects onFailure, timeout and retries on Async bindings', () => {
    const errs = validateHookBinding(
      base({ mode: 'Async' }),
      'preDeploy',
      names,
      trivy,
    );
    expect(errs.join('\n')).toContain('Async hooks cannot set');
    const { onFailure, timeout, retries, ...async } = base();
    expect(
      validateHookBinding(
        { ...async, mode: 'Async' },
        'preDeploy',
        names,
        trivy,
      ),
    ).toEqual([]);
  });

  it('restricts Block to pre-deploy and Alert to post-deploy', () => {
    expect(
      validateHookBinding(
        base({ onFailure: 'Alert' }),
        'preDeploy',
        names,
        trivy,
      ).join('\n'),
    ).toContain('not allowed for pre-deploy');
    expect(
      validateHookBinding(
        base({ onFailure: 'Block' }),
        'postDeploy',
        names,
        trivy,
      ).join('\n'),
    ).toContain('not allowed for post-deploy');
    expect(
      validateHookBinding(
        base({ onFailure: 'Alert' }),
        'postDeploy',
        names,
        trivy,
      ),
    ).toEqual([]);
  });

  it('validates timeout format and retries range', () => {
    expect(
      validateHookBinding(
        base({ timeout: '30 minutes' }),
        'preDeploy',
        names,
        trivy,
      ).join('\n'),
    ).toContain('timeout must be a duration');
    expect(
      validateHookBinding(
        base({ timeout: '1h30m' }),
        'preDeploy',
        names,
        trivy,
      ),
    ).toEqual([]);
    expect(
      validateHookBinding(base({ retries: 6 }), 'preDeploy', names, trivy).join(
        '\n',
      ),
    ).toContain('retries must be between 0 and 5');
  });

  it('rejects appliesTo outside the hook enabledTo', () => {
    expect(
      validateHookBinding(
        base({ appliesTo: [{ kind: 'ClusterComponentType', name: 'worker' }] }),
        'preDeploy',
        names,
        trivy,
      ).join('\n'),
    ).toContain('not in the hook');
  });

  it('rejects undeclared, fixed and non-overridable parameters and a missing required one', () => {
    const errs = validateHookBinding(
      base({ parameters: { bogus: 'x', registry: 'other', image: 'x' } }),
      'preDeploy',
      names,
      trivy,
    ).join('\n');
    expect(errs).toContain('"bogus" is not declared');
    expect(errs).toContain('"registry" is fixed');
    expect(errs).toContain('"image" is computed');
    expect(errs).toContain('"ticket" is required');
  });

  it('checks structure without a resolved hook (unknown hooks are a warning server-side)', () => {
    expect(validateHookBinding(base(), 'preDeploy', names)).toEqual([]);
  });

  it('validateHookSet aggregates both phases with shared names', () => {
    const errs = validateHookSet(
      { preDeploy: [base()], postDeploy: [base({ onFailure: 'Alert' })] },
      [trivy],
    );
    expect(errs.filter(e => e.includes('unique across'))).toHaveLength(2);
  });
});

describe('YAML mapping', () => {
  it('emits only what the CRD needs and drops Sync-only fields for Async', () => {
    expect(bindingToYaml(base({ appliesTo: [], parameters: {} }))).toEqual({
      name: 'image-scan',
      hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
      mode: 'Sync',
      onFailure: 'Block',
      timeout: '30m',
      retries: 1,
    });
    expect(bindingToYaml(base({ mode: 'Async', retries: 3 }))).toEqual({
      name: 'image-scan',
      hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
      mode: 'Async',
      parameters: { severity: 'HIGH', ticket: 'CHG-1' },
    });
  });

  it('round-trips a hand-written hooks block byte-for-byte', () => {
    const doc = `
preDeploy:
  - name: image-scan
    hookRef:
      kind: ClusterHook
      name: trivy-image-scan
    mode: Sync
    onFailure: Block
    timeout: 15m
    retries: 1
    appliesTo:
      - kind: ClusterComponentType
        name: service
    parameters:
      severity: CRITICAL,HIGH
      ticket: CHG-1042
postDeploy:
  - name: notify
    hookRef:
      kind: Hook
      name: slack-notify
    mode: Async
`;
    const parsed = YAML.parse(doc);
    const set = hookSetFromYaml(parsed);
    expect(set?.preDeploy[0].retries).toBe(1);
    expect(set?.postDeploy[0].onFailure).toBeUndefined();
    expect(YAML.stringify(hookSetToYaml(set))).toBe(YAML.stringify(parsed));
  });

  it('returns undefined for an empty or missing hooks block so the key is omitted', () => {
    expect(hookSetFromYaml(undefined)).toBeUndefined();
    expect(hookSetFromYaml({ preDeploy: [] })).toBeUndefined();
    expect(hookSetToYaml({ preDeploy: [], postDeploy: [] })).toBeUndefined();
  });

  it('tolerates a partial binding from YAML and defaults the hookRef kind', () => {
    const b = bindingFromYaml({ name: 'x', hookRef: { name: 'h' } });
    expect(b.hookRef.kind).toBe('Hook');
    expect(b.mode).toBe('Sync');
    expect(b.appliesTo).toEqual([]);
    expect(b.parameters).toEqual({});
  });
});
