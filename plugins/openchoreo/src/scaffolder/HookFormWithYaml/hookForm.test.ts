import YAML from 'yaml';
import {
  DEFAULT_FORM_DATA,
  formToYaml,
  summarizeWorkflowSchema,
  unmappedRequiredInputs,
  validateHookForm,
  yamlToForm,
  type HookFormData,
} from './hookForm';

const base: HookFormData = {
  ...DEFAULT_FORM_DATA,
  hook_name: 'trivy-image-scan',
  namespace_name: 'domain:default/finance',
  displayName: 'Trivy scan',
  description: 'Blocks CRITICAL findings',
  workflowKind: 'ClusterWorkflow',
  workflowName: 'trivy-image-scan',
  parameters: [
    {
      name: 'image',
      source: 'from',
      value: '${deployment.workload.containers.main.image}',
      overridable: false,
    },
    {
      name: 'severity',
      source: 'default',
      value: 'CRITICAL',
      overridable: false,
    },
    {
      name: 'registrySecret',
      source: 'value',
      value: 'harbor-pull',
      overridable: false,
    },
    {
      name: 'ignoreUnfixed',
      source: 'from',
      value: '${deployment.environment.isProduction ? "false" : "true"}',
      overridable: true,
    },
    { name: 'ticket', source: 'required', value: '', overridable: false },
  ],
  enabledTo: [{ kind: 'ClusterComponentType', name: 'service' }],
};

// The webhook rejects these shapes; the form must catch them first so the
// engineer never sees a scaffolder failure for a mistake the UI can prevent.
describe('validateHookForm', () => {
  it('accepts a complete hook for both scopes', () => {
    expect(validateHookForm(base, 'namespace')).toEqual([]);
    expect(
      validateHookForm({ ...base, namespace_name: '' }, 'cluster'),
    ).toEqual([]);
  });

  it('requires a valid Kubernetes name and, for a Hook, a namespace', () => {
    expect(validateHookForm({ ...base, hook_name: '' }, 'namespace')).toContain(
      'Hook name is required',
    );
    expect(
      validateHookForm({ ...base, hook_name: 'Bad_Name' }, 'namespace')[0],
    ).toMatch(/lowercase alphanumeric/);
    expect(
      validateHookForm({ ...base, namespace_name: '' }, 'namespace'),
    ).toContain('Namespace is required');
  });

  it('requires a workflow and forces ClusterWorkflow for a ClusterHook', () => {
    expect(
      validateHookForm({ ...base, workflowName: '' }, 'cluster'),
    ).toContain('A workflow is required');
    expect(
      validateHookForm({ ...base, workflowKind: 'Workflow' }, 'cluster'),
    ).toContain('A ClusterHook may only reference a ClusterWorkflow');
    expect(
      validateHookForm({ ...base, workflowKind: 'Workflow' }, 'namespace'),
    ).toEqual([]);
  });

  it('checks parameter names: required, pattern, unique', () => {
    const errs = validateHookForm(
      {
        ...base,
        parameters: [
          { name: '', source: 'default', value: 'x', overridable: false },
          { name: '1bad', source: 'default', value: 'x', overridable: false },
          { name: 'dup', source: 'default', value: 'x', overridable: false },
          { name: 'dup', source: 'default', value: 'y', overridable: false },
        ],
      },
      'cluster',
    );
    expect(errs).toContain('Parameter 1: name is required');
    expect(errs.some(e => e.startsWith('Parameter "1bad"'))).toBe(true);
    expect(errs).toContain('Parameter "dup": duplicate parameter name');
  });

  it('requires a ${…} expression for a from source and overridable only with from', () => {
    const errs = validateHookForm(
      {
        ...base,
        parameters: [
          { name: 'a', source: 'from', value: '', overridable: false },
          {
            name: 'b',
            source: 'from',
            value: 'deployment.release',
            overridable: false,
          },
          { name: 'c', source: 'default', value: 'x', overridable: true },
        ],
      },
      'cluster',
    );
    expect(errs).toContain('Parameter "a": a "from" expression is required');
    expect(
      errs.some(e => e.startsWith('Parameter "b"') && e.includes('${…}')),
    ).toBe(true);
    expect(errs).toContain(
      'Parameter "c": "overridable" only applies to a "from" source',
    );
  });

  it('rejects duplicate and unnamed enabledTo entries', () => {
    const errs = validateHookForm(
      {
        ...base,
        enabledTo: [
          { kind: 'ClusterComponentType', name: 'service' },
          { kind: 'ClusterComponentType', name: 'service' },
          { kind: 'ComponentType', name: '' },
        ],
      },
      'cluster',
    );
    expect(errs).toContain(
      'Enabled for: ClusterComponentType/service is listed twice',
    );
    expect(errs).toContain('Enabled for entry 3: a type name is required');
  });
});

// The YAML side is what the scaffolder posts; a lossy round trip would mean
// the form shows one thing and the API receives another.
describe('formToYaml / yamlToForm', () => {
  it('renders every parameter source with exactly one key', () => {
    const doc = YAML.parse(formToYaml(base, 'cluster'));
    expect(doc.kind).toBe('ClusterHook');
    expect(doc.metadata.namespace).toBeUndefined();
    expect(doc.spec.workflowRef).toEqual({
      kind: 'ClusterWorkflow',
      name: 'trivy-image-scan',
    });
    expect(doc.spec.parameters).toEqual([
      { name: 'image', from: '${deployment.workload.containers.main.image}' },
      { name: 'severity', default: 'CRITICAL' },
      { name: 'registrySecret', value: 'harbor-pull' },
      {
        name: 'ignoreUnfixed',
        from: '${deployment.environment.isProduction ? "false" : "true"}',
        overridable: true,
      },
      { name: 'ticket', required: true },
    ]);
    expect(doc.spec.enabledTo).toEqual([
      { kind: 'ClusterComponentType', name: 'service' },
    ]);
  });

  it('writes the namespace for a Hook and resolves it back to the entity ref', () => {
    const yaml = formToYaml({ ...base, workflowKind: 'Workflow' }, 'namespace');
    const doc = YAML.parse(yaml);
    expect(doc.kind).toBe('Hook');
    expect(doc.metadata.namespace).toBe('finance');
    expect(doc.metadata.annotations['openchoreo.dev/display-name']).toBe(
      'Trivy scan',
    );

    const back = yamlToForm(yaml, 'namespace', [
      { name: 'finance', entityRef: 'domain:default/finance' },
    ]);
    expect(back.namespace_name).toBe('domain:default/finance');
    expect(back.workflowKind).toBe('Workflow');
    expect(back.parameters).toEqual(base.parameters);
    expect(back.enabledTo).toEqual(base.enabledTo);
  });

  it('round-trips a cluster hook unchanged', () => {
    const yaml = formToYaml(base, 'cluster');
    const back = yamlToForm(yaml, 'cluster', []);
    expect(formToYaml({ ...base, ...back }, 'cluster')).toBe(yaml);
  });

  it('omits empty sections so the manifest stays minimal', () => {
    const doc = YAML.parse(
      formToYaml(
        {
          ...base,
          parameters: [],
          enabledTo: [],
          displayName: '',
          description: '',
        },
        'cluster',
      ),
    );
    expect(doc.spec.parameters).toBeUndefined();
    expect(doc.spec.enabledTo).toBeUndefined();
    expect(doc.metadata.annotations).toBeUndefined();
  });
});

describe('summarizeWorkflowSchema', () => {
  it('flattens nested inputs to dot paths and unwraps a parameters wrapper', () => {
    const summary = summarizeWorkflowSchema({
      type: 'object',
      properties: {
        parameters: {
          type: 'object',
          required: ['image'],
          properties: {
            image: { type: 'string' },
            repository: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                branch: { type: 'string' },
              },
            },
          },
        },
      },
    });
    expect(summary.properties).toEqual([
      'image',
      'repository.url',
      'repository.branch',
    ]);
    expect(summary.required).toEqual(['image']);
    expect(unmappedRequiredInputs(summary, [])).toEqual(['image']);
    expect(
      unmappedRequiredInputs(summary, [
        { name: 'image', source: 'required', value: '', overridable: false },
      ]),
    ).toEqual([]);
  });
});
