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
import { SetupCard } from './SetupCard';

// ---- Mocks ----

jest.mock('./LoadingSkeleton', () => ({
  LoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid={`loading-skeleton-${variant}`} />
  ),
}));

jest.mock('../Workload/WorkloadButton', () => ({
  WorkloadButton: ({ onConfigureWorkload }: any) => (
    <button data-testid="workload-button" onClick={onConfigureWorkload}>
      Configure Workload
    </button>
  ),
}));

const mockUpdateAutoDeploy = jest.fn();
jest.mock('../hooks/useAutoDeployUpdate', () => ({
  useAutoDeployUpdate: () => ({
    updateAutoDeploy: mockUpdateAutoDeploy,
    isUpdating: false,
    error: null,
  }),
}));

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

// ---- Helpers ----

const mockClient = createMockOpenChoreoClient();
const testEntity = mockComponentEntity();

function renderSetupCard(props: Partial<React.ComponentProps<typeof SetupCard>> = {}) {
  const defaultProps = {
    loading: false,
    environmentsExist: true,
    isWorkloadEditorSupported: false,
    onConfigureWorkload: jest.fn(),
  };

  return render(
    <MemoryRouter>
      <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
        <EntityProvider entity={testEntity}>
          <SetupCard {...defaultProps} {...props} />
        </EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('SetupCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.getComponentDetails.mockResolvedValue({});
  });

  it('shows loading skeleton when loading with no environments', () => {
    renderSetupCard({ loading: true, environmentsExist: false });

    expect(screen.getByTestId('loading-skeleton-setup')).toBeInTheDocument();
    expect(screen.queryByText('Auto Deploy')).not.toBeInTheDocument();
  });

  it('shows content when loaded', () => {
    renderSetupCard();

    expect(screen.getByText('Set up')).toBeInTheDocument();
    expect(screen.getByText('Manage deployment configuration and settings')).toBeInTheDocument();
    expect(screen.getByText('Auto Deploy')).toBeInTheDocument();
  });

  it('fetches and displays autoDeploy=true from component details', async () => {
    mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: true });

    renderSetupCard();

    await waitFor(() => {
      const switchEl = screen.getByRole('checkbox', { name: /auto deploy/i });
      expect(switchEl).toBeChecked();
    });
  });

  it('fetches and displays autoDeploy=false from component details', async () => {
    mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: false });

    renderSetupCard();

    await waitFor(() => {
      const switchEl = screen.getByRole('checkbox', { name: /auto deploy/i });
      expect(switchEl).not.toBeChecked();
    });
  });

  it('switch defaults to unchecked when autoDeploy is undefined', () => {
    mockClient.getComponentDetails.mockResolvedValue({});

    renderSetupCard();

    const switchEl = screen.getByRole('checkbox', { name: /auto deploy/i });
    expect(switchEl).not.toBeChecked();
  });

  it('opens confirmation dialog when toggle is clicked', async () => {
    const user = userEvent.setup();
    mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: false });

    renderSetupCard();

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto deploy/i })).not.toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));

    expect(screen.getByText('Enable Auto Deploy?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls updateAutoDeploy on confirm and shows success notification', async () => {
    const user = userEvent.setup();
    mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: false });
    mockUpdateAutoDeploy.mockResolvedValue(true);

    renderSetupCard();

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto deploy/i })).not.toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    await user.click(screen.getByText('Confirm'));

    expect(mockUpdateAutoDeploy).toHaveBeenCalledWith(true);
    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith(
        'Auto deploy enabled successfully',
      );
    });
  });

  it('shows error notification when updateAutoDeploy fails', async () => {
    const user = userEvent.setup();
    mockClient.getComponentDetails.mockResolvedValue({ autoDeploy: true });
    mockUpdateAutoDeploy.mockResolvedValue(false);

    renderSetupCard();

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto deploy/i })).toBeChecked();
    });

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    await user.click(screen.getByText('Confirm'));

    expect(mockUpdateAutoDeploy).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        'Failed to update auto deploy setting',
      );
    });
  });

  it('closes dialog on cancel without calling updateAutoDeploy', async () => {
    const user = userEvent.setup();
    renderSetupCard();

    await user.click(screen.getByRole('checkbox', { name: /auto deploy/i }));
    expect(screen.getByText('Enable Auto Deploy?')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Enable Auto Deploy?')).not.toBeInTheDocument();
    });
    expect(mockUpdateAutoDeploy).not.toHaveBeenCalled();
  });

  it('shows WorkloadButton when isWorkloadEditorSupported is true', () => {
    renderSetupCard({ isWorkloadEditorSupported: true });

    expect(screen.getByTestId('workload-button')).toBeInTheDocument();
  });

  it('hides WorkloadButton when isWorkloadEditorSupported is false', () => {
    renderSetupCard({ isWorkloadEditorSupported: false });

    expect(screen.queryByTestId('workload-button')).not.toBeInTheDocument();
  });

  it('silently handles getComponentDetails failure', async () => {
    mockClient.getComponentDetails.mockRejectedValue(new Error('Network error'));

    renderSetupCard();

    // Should render normally with switch unchecked (default)
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /auto deploy/i })).not.toBeChecked();
    });
  });
});
