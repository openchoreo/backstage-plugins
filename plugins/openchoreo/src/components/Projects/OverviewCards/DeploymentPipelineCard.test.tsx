import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockSystemEntity } from '@openchoreo/test-utils';
import { DeploymentPipelineCard } from './DeploymentPipelineCard';

// ---- Mocks ----

// Mock useDeploymentPipeline hook
const mockUseDeploymentPipeline = jest.fn();
jest.mock('../hooks', () => ({
  useDeploymentPipeline: () => mockUseDeploymentPipeline(),
}));

// Mock permission hook
const mockUseProjectUpdatePermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useProjectUpdatePermission: () => mockUseProjectUpdatePermission(),
  PipelineFlowVisualization: (props: any) => (
    <div data-testid="pipeline-flow">{props.environments?.join(' -> ')}</div>
  ),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">{props.message}</div>
  ),
}));

// Mock design system Card — keep real theme tokens so that styles.ts
// (`lightTokens.shadow.card`) still resolves when the component mounts.
jest.mock('@openchoreo/backstage-design-system', () => ({
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  Card: ({ children, ...props }: any) => (
    <div data-testid="ds-card" {...props}>
      {children}
    </div>
  ),
}));

// Mock common annotations
jest.mock('@openchoreo/backstage-plugin-common', () => ({
  CHOREO_ANNOTATIONS: {
    NAMESPACE: 'openchoreo.io/namespace',
  },
}));

// Mock ChangePipelineDialog
jest.mock('./ChangePipelineDialog', () => ({
  ChangePipelineDialog: () => null,
}));

// Mock error utils
jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: (err: any) =>
    err?.message?.includes('403') || err?.name === 'ForbiddenError',
  isNotFoundError: (err: any) =>
    err?.message?.includes('404') || err?.name === 'NotFoundError',
}));

// ---- Helpers ----

const testEntity = mockSystemEntity({ name: 'test-project' });

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <EntityProvider entity={testEntity}>{ui}</EntityProvider>
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('DeploymentPipelineCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProjectUpdatePermission.mockReturnValue({
      canUpdate: true,
      loading: false,
      updateDeniedTooltip: '',
    });
  });

  it('shows loading state', () => {
    mockUseDeploymentPipeline.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter(<DeploymentPipelineCard />);

    // During loading, skeleton elements render instead of real content
    expect(screen.getByTestId('ds-card')).toBeInTheDocument();
    expect(screen.queryByText('Deployment Pipeline')).not.toBeInTheDocument();
  });

  it('renders pipeline info when loaded', () => {
    mockUseDeploymentPipeline.mockReturnValue({
      data: {
        name: 'default-pipeline',
        resourceName: 'default-pipeline',
        environments: ['development', 'staging', 'production'],
        pipelineEntityRef: 'deploymentpipeline:default/default-pipeline',
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter(<DeploymentPipelineCard />);

    expect(screen.getByText('Deployment Pipeline')).toBeInTheDocument();
    expect(screen.getByText('default-pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('pipeline-flow')).toBeInTheDocument();
    expect(
      screen.getByText('development -> staging -> production'),
    ).toBeInTheDocument();
  });

  it('shows empty state when no environments in pipeline', () => {
    mockUseDeploymentPipeline.mockReturnValue({
      data: {
        name: 'empty-pipeline',
        resourceName: 'empty-pipeline',
        environments: [],
        pipelineEntityRef: undefined,
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithRouter(<DeploymentPipelineCard />);

    expect(screen.getByText('Deployment Pipeline')).toBeInTheDocument();
    expect(
      screen.getByText('No deployment pipeline configured'),
    ).toBeInTheDocument();
  });
});
