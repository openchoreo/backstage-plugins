import { useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  ClusterHookFormWithYamlExtension,
  HookFormWithYamlExtension,
  clusterHookFormWithYamlValidation,
} from './HookFormWithYamlExtension';
import type { HookFormData } from './hookForm';

if (typeof globalThis.structuredClone === 'undefined') {
  (globalThis as any).structuredClone = (v: unknown) =>
    JSON.parse(JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// Mocks — stable object identities, matching real useApi()
// ---------------------------------------------------------------------------
const mockGetEntities = jest.fn();
const mockCatalogApi = { getEntities: mockGetEntities };
const mockFetch = jest.fn();
const mockFetchApi = { fetch: mockFetch };
const mockDiscoveryApi = {
  getBaseUrl: jest.fn(async (id: string) => `http://${id}`),
};

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: (ref: any) => {
    if (ref?.id === 'catalog') return mockCatalogApi;
    if (ref?.id === 'discovery') return mockDiscoveryApi;
    return mockFetchApi;
  },
  discoveryApiRef: { id: 'discovery' },
  fetchApiRef: { id: 'fetch' },
}));
jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'catalog' },
}));

let namespaceFieldProps: any;
jest.mock('../NamespaceEntityPicker', () => ({
  NamespaceSelectField: (props: any) => {
    namespaceFieldProps = props;
    return (
      <input
        data-testid="namespace-select"
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
      />
    );
  },
}));

let yamlEditorProps: any;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  YamlEditor: (props: any) => {
    yamlEditorProps = props;
    return <div data-testid="yaml-editor" />;
  },
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  FormYamlToggle: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: 'form' | 'yaml') => void;
  }) => (
    <div>
      <span data-testid="mode-value">{value}</span>
      <button onClick={() => onChange('form')}>switch-to-form</button>
      <button onClick={() => onChange('yaml')}>switch-to-yaml</button>
    </div>
  ),
}));

jest.mock('./styles', () => ({
  useStyles: () => new Proxy({}, { get: (_t, key) => String(key) }),
}));

const entity = (kind: string, name: string, ns?: string, type?: string) => ({
  kind,
  metadata: {
    name,
    annotations: ns ? { 'openchoreo.io/namespace': ns } : {},
  },
  ...(type ? { spec: { type } } : {}),
});

function catalogByKind(filter: any) {
  const kinds = (Array.isArray(filter) ? filter : [filter]).map(
    (f: any) => f.kind,
  );
  const all = [
    entity('ClusterWorkflow', 'trivy-image-scan'),
    entity('ClusterWorkflow', 'dockerfile-builder', undefined, 'CI'),
    entity('Workflow', 'smoke-test', 'finance'),
    entity('Workflow', 'react-builder', 'finance', 'CI'),
    entity('ClusterComponentType', 'service'),
    entity('ComponentType', 'batch', 'finance'),
  ];
  return { items: all.filter(e => kinds.includes(e.kind)) };
}

let latestFormData: HookFormData | undefined;

function Harness({
  scope,
  initial,
  rawErrors = [],
}: {
  scope: 'namespace' | 'cluster';
  initial?: Partial<HookFormData>;
  rawErrors?: string[];
}) {
  const [formData, setFormData] = useState<HookFormData | undefined>(
    initial as HookFormData | undefined,
  );
  const props = {
    rawErrors,
    formContext: {},
    formData,
    onChange: (next: HookFormData | undefined) => {
      latestFormData = next;
      setFormData(next);
    },
  } as unknown as FieldExtensionComponentProps<HookFormData>;
  return scope === 'cluster' ? (
    <ClusterHookFormWithYamlExtension {...props} />
  ) : (
    <HookFormWithYamlExtension {...props} />
  );
}

function getFieldByLabel(label: string): HTMLElement {
  const labelEl = Array.from(document.querySelectorAll('label')).find(el =>
    el.textContent?.includes(label),
  );
  if (!labelEl) throw new Error(`no label containing: ${label}`);
  const field = labelEl
    .closest('.MuiFormControl-root')
    ?.querySelector('input, textarea');
  if (!field) throw new Error(`no input for label: ${label}`);
  return field as HTMLElement;
}

describe('HookFormWithYamlExtension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestFormData = undefined;
    namespaceFieldProps = undefined;
    yamlEditorProps = undefined;
    mockGetEntities.mockImplementation(async ({ filter }: any) =>
      catalogByKind(filter),
    );
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'object',
        required: ['image'],
        properties: { image: { type: 'string' }, severity: { type: 'string' } },
      }),
    });
  });

  it('a cluster hook has no namespace field and always emits YAML with kind ClusterHook', async () => {
    render(<Harness scope="cluster" />);
    expect(screen.queryByTestId('namespace-select')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(latestFormData?.yamlContent).toContain('kind: ClusterHook'),
    );
    expect(latestFormData?.workflowKind).toBe('ClusterWorkflow');
  });

  it('a namespaced hook preselects the default namespace and offers namespaced workflows', async () => {
    render(<Harness scope="namespace" />);
    act(() => {
      namespaceFieldProps.onNamespacesLoaded([
        { name: 'finance', entityRef: 'domain:default/finance' },
        { name: 'default', entityRef: 'domain:default/default' },
      ]);
    });
    await waitFor(() =>
      expect(latestFormData?.namespace_name).toBe('domain:default/default'),
    );
    // Switch to finance and check the Workflow from that namespace is listed.
    fireEvent.change(screen.getByTestId('namespace-select'), {
      target: { value: 'domain:default/finance' },
    });
    await waitFor(() =>
      expect(mockGetEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: [{ kind: 'ClusterWorkflow' }, { kind: 'Workflow' }],
        }),
      ),
    );
    await waitFor(() =>
      expect(latestFormData?.yamlContent).toContain('namespace: finance'),
    );
  });

  it('selecting a workflow loads its schema and pre-adds required inputs as Required rows', async () => {
    render(<Harness scope="cluster" initial={{ hook_name: 'scan' } as any} />);
    // Open the workflow select and pick the cluster workflow.
    const trigger = screen
      .getAllByRole('button')
      .find(b =>
        b.closest('.MuiFormControl-root')?.textContent?.includes('Workflow'),
      );
    fireEvent.mouseDown(trigger!);
    fireEvent.click(await screen.findByText(/trivy-image-scan/));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        'http://openchoreo-ci-backend/cluster-workflow-schema?workflowName=trivy-image-scan',
      ),
    );
    await waitFor(() =>
      expect(latestFormData?.parameters).toEqual([
        { name: 'image', source: 'required', value: '', overridable: false },
      ]),
    );
    expect(latestFormData?.yamlContent).toContain('required: true');
  });

  it('shows the webhook rules as inline errors while a parameter is invalid', async () => {
    render(
      <Harness
        scope="cluster"
        initial={
          {
            hook_name: 'scan',
            workflowKind: 'ClusterWorkflow',
            workflowName: 'trivy-image-scan',
            parameters: [
              {
                name: 'image',
                source: 'from',
                value: 'no-expression',
                overridable: false,
              },
            ],
            enabledTo: [],
          } as any
        }
      />,
    );
    expect(await screen.findByTestId('hook-form-errors')).toHaveTextContent(
      'Parameter "image": "from" must contain a ${…} expression',
    );
    fireEvent.change(getFieldByLabel('Expression'), {
      target: { value: '${deployment.workload.containers.main.image}' },
    });
    await waitFor(() =>
      expect(screen.queryByTestId('hook-form-errors')).not.toBeInTheDocument(),
    );
  });

  // Clicking Review with an incomplete parameter must point at the fields to
  // fix, not only list messages at the bottom; before that, an empty new row
  // is not shown as an error.
  it('marks the empty name and expression fields once review was attempted', async () => {
    const initial = {
      hook_name: 'scan',
      workflowKind: 'ClusterWorkflow',
      workflowName: 'trivy-image-scan',
      parameters: [{ name: '', source: 'from', value: '', overridable: false }],
      enabledTo: [],
    } as any;
    const field = (label: string) =>
      getFieldByLabel(label).closest('.MuiFormControl-root') as HTMLElement;

    const { unmount } = render(<Harness scope="cluster" initial={initial} />);
    await screen.findByText('Overridable by a binding');
    expect(field('Input name')).not.toHaveTextContent('Name is required');
    expect(field('Expression')).not.toHaveTextContent('Expression is required');
    unmount();

    render(
      <Harness
        scope="cluster"
        initial={initial}
        rawErrors={['Parameter 1: name is required']}
      />,
    );
    await screen.findByText('Overridable by a binding');
    expect(field('Input name')).toHaveTextContent('Name is required');
    expect(field('Input name').querySelector('.Mui-error')).not.toBeNull();
    expect(field('Expression')).toHaveTextContent('Expression is required');
    expect(field('Expression').querySelector('.Mui-error')).not.toBeNull();
  });

  it('marks a duplicate parameter name once review was attempted', async () => {
    render(
      <Harness
        scope="cluster"
        rawErrors={['Parameter "image": duplicate parameter name']}
        initial={
          {
            hook_name: 'scan',
            workflowKind: 'ClusterWorkflow',
            workflowName: 'trivy-image-scan',
            parameters: [
              {
                name: 'image',
                source: 'default',
                value: 'a',
                overridable: false,
              },
              {
                name: 'image',
                source: 'default',
                value: 'b',
                overridable: false,
              },
            ],
            enabledTo: [],
          } as any
        }
      />,
    );
    expect(
      await screen.findAllByText('Another parameter already uses this name'),
    ).toHaveLength(2);
  });

  it('toggles enabledTo chips and writes them to the YAML', async () => {
    render(<Harness scope="cluster" initial={{ hook_name: 'scan' } as any} />);
    const chip = await screen.findByText('service (cluster)');
    fireEvent.click(chip);
    await waitFor(() =>
      expect(latestFormData?.enabledTo).toEqual([
        { kind: 'ClusterComponentType', name: 'service' },
      ]),
    );
    expect(latestFormData?.yamlContent).toContain('kind: ClusterComponentType');
    fireEvent.click(screen.getByText('service (cluster)'));
    await waitFor(() => expect(latestFormData?.enabledTo).toEqual([]));
  });

  it('YAML mode edits flow back into the form fields', async () => {
    render(<Harness scope="cluster" initial={{ hook_name: 'scan' } as any} />);
    fireEvent.click(screen.getByText('switch-to-yaml'));
    expect(screen.getByTestId('mode-value')).toHaveTextContent('yaml');
    expect(yamlEditorProps.content).toContain('name: scan');

    act(() => {
      yamlEditorProps.onChange(
        [
          'apiVersion: openchoreo.dev/v1alpha1',
          'kind: ClusterHook',
          'metadata:',
          '  name: renamed',
          'spec:',
          '  workflowRef: { kind: ClusterWorkflow, name: trivy-image-scan }',
          '  parameters:',
          '    - name: image',
          '      from: ${deployment.workload.containers.main.image}',
          '    - name: severity',
          '      default: HIGH',
        ].join('\n'),
      );
    });
    await waitFor(() => expect(latestFormData?.hook_name).toBe('renamed'));
    // `image` is already mapped, so the schema's required-input seeding adds nothing.
    await waitFor(() =>
      expect(latestFormData?.parameters).toEqual([
        {
          name: 'image',
          source: 'from',
          value: '${deployment.workload.containers.main.image}',
          overridable: false,
        },
        {
          name: 'severity',
          source: 'default',
          value: 'HIGH',
          overridable: false,
        },
      ]),
    );

    fireEvent.click(screen.getByText('switch-to-form'));
    expect(screen.getByTestId('mode-value')).toHaveTextContent('form');
    expect(getFieldByLabel('Cluster Hook Name')).toHaveValue('renamed');
  });

  it('validation adds one error per webhook rule', () => {
    const errors: string[] = [];
    const validation = {
      addError: (m: string) => errors.push(m),
    } as unknown as FieldValidation;
    clusterHookFormWithYamlValidation(
      { hook_name: 'ok', workflowKind: 'Workflow', workflowName: '' } as any,
      validation,
    );
    expect(errors).toEqual([
      'A workflow is required',
      'A ClusterHook may only reference a ClusterWorkflow',
    ]);
  });

  // A build (CI) workflow turns a component's source into an image. A hook runs
  // against a release that already exists, so offering one here would only
  // produce a hook that can never succeed.
  it('omits component build workflows from the workflow picker', async () => {
    render(<Harness scope="namespace" />);
    await waitFor(() => expect(mockGetEntities).toHaveBeenCalled());
    // MUI renders the menu in a popover, so the options only exist once open.
    const select = await screen.findByTestId('workflow-select');
    const trigger = select.parentElement?.querySelector(
      '[role="button"], [role="combobox"]',
    );
    fireEvent.mouseDown(trigger ?? select);
    const names = (await screen.findAllByRole('option'))
      .map(o => o.textContent ?? '')
      .join(' ');
    expect(names).toContain('trivy-image-scan');
    expect(names).not.toContain('dockerfile-builder');
    expect(names).not.toContain('react-builder');
  });
});
