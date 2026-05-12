import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import {
  createMockOpenChoreoClient,
  mockComponentEntity,
} from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { SetupDetailPane } from './SetupDetailPane';

// ---- Mocks ----

jest.mock('./LoadingSkeleton', () => ({
  LoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid={`loading-skeleton-${variant}`} />
  ),
}));

jest.mock('./DeployReleasePanel', () => ({
  DeployReleasePanel: ({ disabled }: any) => (
    <div
      data-testid="deploy-release-panel"
      data-disabled={String(!!disabled)}
    />
  ),
}));

jest.mock('./ReleaseBrowserDialog', () => ({
  ReleaseBrowserDialog: ({ open, readOnly }: any) =>
    open ? (
      <div
        data-testid="release-browser-dialog"
        data-readonly={String(!!readOnly)}
      />
    ) : null,
}));

const mockUpdateAutoDeploy = jest.fn();
jest.mock('../hooks/useAutoDeployUpdate', () => ({
  useAutoDeployUpdate: () => ({
    updateAutoDeploy: mockUpdateAutoDeploy,
    isUpdating: false,
    error: null,
  }),
}));

let readinessOverride: any = null;
jest.mock('../hooks/useReleaseReadiness', () => ({
  useReleaseReadiness: () =>
    readinessOverride ?? {
      loading: false,
      canCreateRelease: true,
      alertMessage: null,
      alertSeverity: 'info',
      hasWorkload: true,
      isFromSource: false,
    },
}));

jest.mock('../hooks/useReleases', () => ({
  useReleases: () => ({
    releases: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

let permissionOverride: any = null;
jest.mock('@openchoreo/backstage-plugin-react', () => {
  const actual = jest.requireActual('@openchoreo/backstage-plugin-react');
  return {
    ...actual,
    useConfigureAndDeployPermission: () =>
      permissionOverride ?? {
        canConfigureAndDeploy: true,
        loading: false,
        deniedTooltip: '',
      },
  };
});

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock('../../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    hide: jest.fn(),
  }),
}));

const mockRefetchAutoDeploy = jest.fn();
let contextOverride: Partial<{
  autoDeploy: boolean;
  autoDeployLoading: boolean;
}> = {};
jest.mock('../EnvironmentsContext', () => ({
  useEnvironmentsContext: () => ({
    environments: [{ name: 'development', deployment: {}, endpoints: [] }],
    displayEnvironments: [],
    loading: false,
    refetch: jest.fn(),
    lowestEnvironment: 'development',
    isWorkloadEditorSupported: true,
    onPendingActionComplete: jest.fn(),
    canViewEnvironments: true,
    environmentReadPermissionLoading: false,
    canViewBindings: true,
    bindingsPermissionLoading: false,
    autoDeploy: false,
    autoDeployLoading: false,
    refetchAutoDeploy: mockRefetchAutoDeploy,
    selection: null,
    setSelection: jest.fn(),
    ...contextOverride,
  }),
}));

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();
const testEntity = mockComponentEntity();

const renderPane = (
  props: Partial<React.ComponentProps<typeof SetupDetailPane>> = {},
) =>
  render(
    <MemoryRouter>
      <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
        <EntityProvider entity={testEntity}>
          <SetupDetailPane
            environmentsExist
            isWorkloadEditorSupported
            loading={false}
            onConfigureWorkload={jest.fn()}
            onClose={jest.fn()}
            {...props}
          />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  readinessOverride = null;
  permissionOverride = null;
  contextOverride = {};
  mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: false });
});

describe('SetupDetailPane', () => {
  it('renders both stories: Create release button and the deploy panel', async () => {
    renderPane();

    expect(
      await screen.findByRole('button', { name: /create release/i }),
    ).toBeEnabled();
    expect(screen.getByTestId('deploy-release-panel')).toBeInTheDocument();
  });

  it('Create release navigates to the workload page (onConfigureWorkload)', async () => {
    const onConfigureWorkload = jest.fn();
    const user = userEvent.setup();
    renderPane({ onConfigureWorkload });

    await user.click(
      await screen.findByRole('button', { name: /create release/i }),
    );

    expect(onConfigureWorkload).toHaveBeenCalledTimes(1);
  });

  it('disables Create release when readiness blocks it and surfaces the reason', async () => {
    readinessOverride = {
      loading: false,
      canCreateRelease: false,
      alertMessage:
        'Build your application first to generate a container image.',
      alertSeverity: 'warning',
      hasWorkload: false,
      isFromSource: true,
    };

    renderPane();

    const button = await screen.findByRole('button', {
      name: /create release/i,
    });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(
        'Build your application first to generate a container image.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms auto-deploy changes through the confirmation dialog', async () => {
    const user = userEvent.setup();
    mockUpdateAutoDeploy.mockResolvedValue(true);
    renderPane();

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: /auto deploy/i }),
      ).not.toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    expect(screen.getByText('Enable Auto Deploy?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(mockUpdateAutoDeploy).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Auto deploy enabled successfully',
      );
    });
  });

  it('hides the deploy panel and shows Configure component when auto-deploy is on', async () => {
    contextOverride = { autoDeploy: true };
    renderPane();

    expect(
      await screen.findByRole('button', { name: /configure component/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create release/i }),
    ).toBeNull();
    expect(screen.queryByTestId('deploy-release-panel')).toBeNull();
  });

  it('renders the setup skeleton while auto-deploy is loading', () => {
    contextOverride = { autoDeployLoading: true };
    renderPane();

    expect(screen.getByTestId('loading-skeleton-setup')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create release/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /configure component/i }),
    ).toBeNull();
  });

  it('disables actions when the user lacks the deploy permission', async () => {
    permissionOverride = {
      canConfigureAndDeploy: false,
      loading: false,
      deniedTooltip: 'You do not have permission to deploy.',
    };

    renderPane();

    expect(
      await screen.findByRole('button', { name: /create release/i }),
    ).toBeDisabled();
    expect(screen.getByTestId('deploy-release-panel')).toHaveAttribute(
      'data-disabled',
      'true',
    );
  });
});
