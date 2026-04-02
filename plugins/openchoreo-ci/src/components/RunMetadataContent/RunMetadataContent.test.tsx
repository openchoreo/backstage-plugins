import { render, screen } from '@testing-library/react';
import { RunMetadataContent } from './RunMetadataContent';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

// ---- Mocks ----

const mockUseWorkflowRun = jest.fn();
jest.mock('../../hooks', () => ({
  useWorkflowRun: (name: string) => mockUseWorkflowRun(name),
}));

jest.mock('../BuildStatusChip', () => ({
  BuildStatusChip: ({ status }: { status: string }) => (
    <span data-testid="build-status-chip">{status}</span>
  ),
}));

jest.mock('../../utils/schemaExtensions', () => ({
  extractGitFieldValues: (_params: any, _mapping: any) => ({}),
}));

// ---- Helpers ----

const baseBuild: ModelsBuild = {
  name: 'build-42',
  status: 'Succeeded',
  createdAt: '2024-06-01T10:00:00Z',
  commit: 'abc1234567890',
};

function renderContent(
  overrides: Partial<React.ComponentProps<typeof RunMetadataContent>> = {},
) {
  const defaultProps = {
    build: baseBuild,
    ...overrides,
  };

  return render(<RunMetadataContent {...defaultProps} />);
}

// ---- Tests ----

describe('RunMetadataContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading spinner when loading', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: null,
      loading: true,
      error: null,
    });

    renderContent();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: null,
      loading: false,
      error: new Error('Network failure'),
    });

    renderContent();

    expect(
      screen.getByText(/Failed to load workflow run details: Network failure/),
    ).toBeInTheDocument();
  });

  it('displays build name and status when loaded', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: { ...baseBuild },
      loading: false,
      error: null,
    });

    renderContent();

    expect(screen.getByText('Build Information')).toBeInTheDocument();
    expect(screen.getByText('build-42')).toBeInTheDocument();
    expect(screen.getByTestId('build-status-chip')).toHaveTextContent(
      'Succeeded',
    );
  });

  it('displays timestamps section', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: {
        ...baseBuild,
        startedAt: '2024-06-01T10:01:00Z',
      },
      loading: false,
      error: null,
    });

    renderContent();

    expect(screen.getByText('Timestamps')).toBeInTheDocument();
    expect(screen.getByText('Created:')).toBeInTheDocument();
    expect(screen.getByText('Started:')).toBeInTheDocument();
  });

  it('shows completed and duration for terminal runs', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: {
        ...baseBuild,
        startedAt: '2024-06-01T10:00:00Z',
        completedAt: '2024-06-01T10:05:30Z',
      },
      loading: false,
      error: null,
    });

    renderContent();

    expect(screen.getByText('Completed:')).toBeInTheDocument();
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('5m 30s')).toBeInTheDocument();
  });

  it('shows workload pending message for non-terminal runs', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: {
        ...baseBuild,
        status: 'Running',
      },
      loading: false,
      error: null,
    });

    renderContent({ build: { ...baseBuild, status: 'Running' } });

    expect(
      screen.getByText(
        'Workload details will be available once the workflow run completes.',
      ),
    ).toBeInTheDocument();
  });

  it('shows workload not found for terminal run without workloadCr', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: {
        ...baseBuild,
        completedAt: '2024-06-01T10:05:00Z',
      },
      loading: false,
      error: null,
    });

    renderContent();

    expect(
      screen.getByText('Workload details are not found in the workflow run.'),
    ).toBeInTheDocument();
  });

  it('shows workload image when available in workloadCr', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: {
        ...baseBuild,
        completedAt: '2024-06-01T10:05:00Z',
        workloadCr: JSON.stringify({
          spec: { container: { image: 'registry.io/app:v1.0' } },
        }),
      },
      loading: false,
      error: null,
    });

    renderContent();

    expect(screen.getByText('registry.io/app:v1.0')).toBeInTheDocument();
  });

  it('falls back to build data when workflowRun is null', () => {
    mockUseWorkflowRun.mockReturnValue({
      workflowRun: null,
      loading: false,
      error: null,
    });

    renderContent();

    expect(screen.getByText('build-42')).toBeInTheDocument();
  });
});
