import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectParametersConfigPage } from './ProjectParametersConfigPage';

const mockClient = {
  getResourceDefinition: jest.fn(),
  fetchProjectEnvironmentInfo: jest.fn(),
  updateResourceDefinition: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockClient,
  createApiRef: (def: { id: string }) => ({ id: def?.id ?? 'ref' }),
  discoveryApiRef: { id: 'discovery' },
  fetchApiRef: { id: 'fetch' },
}));

const entity = {
  kind: 'System',
  metadata: {
    name: 'my-app',
    annotations: {
      'openchoreo.io/namespace': 'test-ns',
      'openchoreo.io/project-type': 'web-application',
      'openchoreo.io/project-type-kind': 'ClusterProjectType',
    },
  },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

const mockUpdatePerm = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useProjectUpdatePermission: () => mockUpdatePerm(),
  DetailPageLayout: ({ title, subtitle, actions, children, onBack }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <button onClick={onBack}>back</button>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  ),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden">{message}</div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  RjsfForm: ({ onChange }: any) => (
    <button
      data-testid="rjsf-change"
      onClick={() => onChange({ formData: { appName: 'changed' } })}
    >
      change
    </button>
  ),
}));

jest.mock('../../utils/errorUtils', () => ({
  isForbiddenError: (e: any) => e?.__forbidden === true,
  getErrorMessage: (e: any) => String(e?.message ?? e),
}));

const PT_DEF = {
  spec: {
    parameters: {
      openAPIV3Schema: {
        type: 'object',
        properties: { appName: { type: 'string' } },
      },
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    updateDeniedTooltip: '',
  });
  mockClient.getResourceDefinition.mockImplementation((kind: string) => {
    if (kind === 'clusterprojecttypes' || kind === 'projecttypes') {
      return Promise.resolve(PT_DEF);
    }
    // 'projects'
    return Promise.resolve({
      metadata: { name: 'my-app' },
      spec: { parameters: { appName: 'original' } },
    });
  });
  mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
    { name: 'dev', resourceName: 'development', latestRelease: 'rel-1' },
  ]);
  mockClient.updateResourceDefinition.mockResolvedValue({ success: true });
});

describe('ProjectParametersConfigPage', () => {
  it('loads the ProjectType schema + project params and renders the form', async () => {
    render(
      <ProjectParametersConfigPage onBack={jest.fn()} onContinue={jest.fn()} />,
    );

    expect(await screen.findByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.getByText('Configure Project')).toBeInTheDocument();
    expect(
      screen.getByText(/fill in the parameters defined by web-application/i),
    ).toBeInTheDocument();
    // Cluster project types are read via the cluster-scoped endpoint.
    expect(mockClient.getResourceDefinition).toHaveBeenCalledWith(
      'clusterprojecttypes',
      'test-ns',
      'web-application',
    );
  });

  it('skips the PUT and reuses the baseline release when params are unchanged', async () => {
    const onContinue = jest.fn();
    render(
      <ProjectParametersConfigPage
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(onContinue).toHaveBeenCalledWith('development', 'rel-1'),
    );
    expect(mockClient.updateResourceDefinition).not.toHaveBeenCalled();
  });

  it('PUTs changed params, waits for the new release, then continues', async () => {
    const onContinue = jest.fn();
    // Load returns rel-1; the post-save poll returns rel-2.
    mockClient.fetchProjectEnvironmentInfo
      .mockResolvedValueOnce([
        { name: 'dev', resourceName: 'development', latestRelease: 'rel-1' },
      ])
      .mockResolvedValue([
        { name: 'dev', resourceName: 'development', latestRelease: 'rel-2' },
      ]);

    render(
      <ProjectParametersConfigPage
        onBack={jest.fn()}
        onContinue={onContinue}
      />,
    );

    // Edit a parameter so hasChanges flips true.
    fireEvent.click(await screen.findByTestId('rjsf-change'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(mockClient.updateResourceDefinition).toHaveBeenCalledWith(
        'projects',
        'test-ns',
        'my-app',
        expect.objectContaining({
          spec: expect.objectContaining({
            parameters: { appName: 'changed' },
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(onContinue).toHaveBeenCalledWith('development', 'rel-2'),
    );
  });

  it('shows the empty-state when the type declares no parameters', async () => {
    mockClient.getResourceDefinition.mockImplementation((kind: string) => {
      if (kind === 'clusterprojecttypes' || kind === 'projecttypes') {
        return Promise.resolve({ spec: {} });
      }
      return Promise.resolve({ spec: { parameters: {} } });
    });

    render(
      <ProjectParametersConfigPage onBack={jest.fn()} onContinue={jest.fn()} />,
    );

    expect(
      await screen.findByText(
        /web-application has no configurable parameters/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders the ForbiddenState when the load is forbidden', async () => {
    const forbidden = Object.assign(new Error('forbidden'), {
      __forbidden: true,
    });
    mockClient.getResourceDefinition.mockRejectedValue(forbidden);

    render(
      <ProjectParametersConfigPage onBack={jest.fn()} onContinue={jest.fn()} />,
    );

    expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
  });

  it('disables Next when the user lacks project-update permission', async () => {
    mockUpdatePerm.mockReturnValue({
      canUpdate: false,
      loading: false,
      updateDeniedTooltip: 'nope',
    });

    render(
      <ProjectParametersConfigPage onBack={jest.fn()} onContinue={jest.fn()} />,
    );

    expect(await screen.findByRole('button', { name: /next/i })).toBeDisabled();
  });
});
