import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { ProjectEnvironmentOverridesPage } from './ProjectEnvironmentOverridesPage';

const mockClient = {
  fetchProjectEnvironmentInfo: jest.fn(),
  fetchProjectReleaseBindings: jest.fn(),
  fetchProjectReleaseSchema: jest.fn(),
  updateProjectReleaseBinding: jest.fn(),
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
      onClick={() => onChange({ formData: { replicas: 5 } })}
    >
      change
    </button>
  ),
}));

jest.mock('../../utils/errorUtils', () => ({
  isForbiddenError: (e: any) => e?.__forbidden === true,
  getErrorMessage: (e: any) => String(e?.message ?? e),
}));

const SCHEMA = {
  success: true,
  data: {
    type: 'object',
    properties: { replicas: { type: 'integer' } },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdatePerm.mockReturnValue({
    canUpdate: true,
    loading: false,
    updateDeniedTooltip: '',
  });
  mockClient.fetchProjectReleaseSchema.mockResolvedValue(SCHEMA);
  mockClient.updateProjectReleaseBinding.mockResolvedValue({ ok: true });
});

describe('ProjectEnvironmentOverridesPage (deploy mode)', () => {
  beforeEach(() => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      { name: 'dev', resourceName: 'development', latestRelease: 'rel-2' },
    ]);
    mockClient.fetchProjectReleaseBindings.mockResolvedValue({
      data: { items: [] },
    });
  });

  it('deploys the pinned release with the entered overrides', async () => {
    const onSaved = jest.fn();
    render(
      <ProjectEnvironmentOverridesPage
        envName="development"
        releaseFromUrl="rel-2"
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );

    const deploy = await screen.findByRole('button', { name: /^deploy$/i });
    fireEvent.click(await screen.findByTestId('rjsf-change'));
    fireEvent.click(deploy);

    await waitFor(() =>
      expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
        entity,
        'development',
        { projectRelease: 'rel-2', environmentConfigs: { replicas: 5 } },
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // The release-snapshot schema is read for the pinned release.
    expect(mockClient.fetchProjectReleaseSchema).toHaveBeenCalledWith(
      'test-ns',
      'rel-2',
      'environmentConfigs',
    );
  });

  it('shows the empty-state when the release has no environmentConfigs schema', async () => {
    mockClient.fetchProjectReleaseSchema.mockResolvedValue({
      success: true,
      data: {},
    });

    render(
      <ProjectEnvironmentOverridesPage
        envName="development"
        releaseFromUrl="rel-2"
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(
      await screen.findByText(
        /web-application declares no environment-configs/i,
      ),
    ).toBeInTheDocument();
  });
});

describe('ProjectEnvironmentOverridesPage (promote mode)', () => {
  beforeEach(() => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      {
        name: 'Staging',
        resourceName: 'staging',
        bindingName: 'my-app-staging',
        projectRelease: 'rel-1',
      },
    ]);
    mockClient.fetchProjectReleaseBindings.mockResolvedValue({
      data: {
        items: [
          { environment: 'staging', environmentConfigs: { replicas: 2 } },
        ],
      },
    });
  });

  it('reviews overrides before saving the selected release and edited values together', async () => {
    const onSaved = jest.fn();
    let finishPromotion!: () => void;
    mockClient.updateProjectReleaseBinding.mockReturnValue(
      new Promise<void>(resolve => {
        finishPromotion = resolve;
      }),
    );

    render(
      <ProjectEnvironmentOverridesPage
        envName="staging"
        releaseFromUrl="rel-2"
        action="promote"
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );

    const promote = await screen.findByRole('button', { name: 'Promote' });
    expect(
      screen.getByRole('heading', { name: 'Promote to Staging' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Review Staging-specific overrides, then promote rel-2.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /clear overrides/i }),
    ).not.toBeInTheDocument();
    expect(mockClient.fetchProjectReleaseSchema).toHaveBeenCalledWith(
      'test-ns',
      'rel-2',
      'environmentConfigs',
    );
    expect(mockClient.updateProjectReleaseBinding).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('rjsf-change'));
    fireEvent.click(promote);

    expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
      entity,
      'staging',
      { projectRelease: 'rel-2', environmentConfigs: { replicas: 5 } },
    );
    expect(screen.getByRole('button', { name: 'Promoting' })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => finishPromotion());
    expect(
      await screen.findByText(/Promoted rel-2 to Staging\./),
    ).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('promotes to an environment without a binding or override edits', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      { name: 'Staging', resourceName: 'staging' },
    ]);
    mockClient.fetchProjectReleaseBindings.mockResolvedValue({
      data: { items: [] },
    });

    render(
      <ProjectEnvironmentOverridesPage
        envName="staging"
        releaseFromUrl="rel-2"
        action="promote"
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    const promote = await screen.findByRole('button', { name: 'Promote' });
    expect(promote).toBeEnabled();
    expect(screen.queryByText(/no binding exists/i)).not.toBeInTheDocument();
    fireEvent.click(promote);
    await waitFor(() =>
      expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
        entity,
        'staging',
        { projectRelease: 'rel-2', environmentConfigs: {} },
      ),
    );
  });

  it('discards obsolete overrides when the promoted release has no override schema', async () => {
    mockClient.fetchProjectReleaseSchema.mockResolvedValue({
      success: true,
      data: {},
    });
    render(
      <ProjectEnvironmentOverridesPage
        envName="staging"
        releaseFromUrl="rel-2"
        action="promote"
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(
      await screen.findByText(/declares no environment-configs/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Promote' }));
    await waitFor(() =>
      expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
        entity,
        'staging',
        { projectRelease: 'rel-2', environmentConfigs: {} },
      ),
    );
  });
});

describe('ProjectEnvironmentOverridesPage (edit mode)', () => {
  it('saves changed overrides while keeping the existing release', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      {
        name: 'dev',
        resourceName: 'development',
        bindingName: 'my-app-development',
        projectRelease: 'rel-1',
      },
    ]);
    mockClient.fetchProjectReleaseBindings.mockResolvedValue({
      data: {
        items: [
          { environment: 'development', environmentConfigs: { replicas: 2 } },
        ],
      },
    });
    const onSaved = jest.fn();
    render(
      <ProjectEnvironmentOverridesPage
        envName="development"
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );

    const save = await screen.findByRole('button', { name: 'Save Overrides' });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByTestId('rjsf-change'));
    fireEvent.click(save);
    await waitFor(() =>
      expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
        entity,
        'development',
        { projectRelease: 'rel-1', environmentConfigs: { replicas: 5 } },
      ),
    );
    expect(
      await screen.findByText(/Saved overrides for dev\./),
    ).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('shows an info banner when the env has no binding yet', async () => {
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      { name: 'dev', resourceName: 'development', latestRelease: 'rel-2' },
    ]);
    mockClient.fetchProjectReleaseBindings.mockResolvedValue({
      data: { items: [] },
    });

    render(
      <ProjectEnvironmentOverridesPage
        envName="development"
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(
      await screen.findByText(/no binding exists for dev yet/i),
    ).toBeInTheDocument();
  });

  it('clears overrides on an existing binding', async () => {
    const onSaved = jest.fn();
    mockClient.fetchProjectEnvironmentInfo.mockResolvedValue([
      {
        name: 'dev',
        resourceName: 'development',
        bindingName: 'my-app-development',
        projectRelease: 'rel-2',
        latestRelease: 'rel-2',
      },
    ]);
    mockClient.fetchProjectReleaseBindings.mockResolvedValue({
      data: {
        items: [
          { environment: 'development', environmentConfigs: { replicas: 2 } },
        ],
      },
    });

    render(
      <ProjectEnvironmentOverridesPage
        envName="development"
        onBack={jest.fn()}
        onSaved={onSaved}
      />,
    );

    const clear = await screen.findByRole('button', {
      name: /clear overrides/i,
    });
    expect(clear).toBeEnabled();
    fireEvent.click(clear);

    await waitFor(() =>
      expect(mockClient.updateProjectReleaseBinding).toHaveBeenCalledWith(
        entity,
        'development',
        { projectRelease: 'rel-2', environmentConfigs: {} },
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('renders the ForbiddenState when the load is forbidden', async () => {
    const forbidden = Object.assign(new Error('forbidden'), {
      __forbidden: true,
    });
    mockClient.fetchProjectEnvironmentInfo.mockRejectedValue(forbidden);
    mockClient.fetchProjectReleaseBindings.mockRejectedValue(forbidden);

    render(
      <ProjectEnvironmentOverridesPage
        envName="development"
        onBack={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
  });
});
