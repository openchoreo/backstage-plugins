import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectDeployFlowCanvas } from './ProjectDeployFlowCanvas';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';

jest.mock('@openchoreo/backstage-design-system', () => ({
  useChoreoTokens: () => ({ graph: { canvasDotPattern: 'dots' } }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  MINI_ENV_NODE_WIDTH: 200,
  MINI_ENV_NODE_HEIGHT: 100,
  MINI_SETUP_NODE_WIDTH: 150,
  MINI_SETUP_NODE_HEIGHT: 80,
  buildEnvPipelineNodes: (envs: any) => envs,
  computePipelineLayout: () => ({
    width: 500,
    height: 300,
    nodes: [
      { id: '__setup__', isSetup: true, x: 0, y: 0, width: 150, height: 80 },
      { id: 'dev', isSetup: false, x: 200, y: 0, width: 200, height: 100 },
    ],
    edges: [{ from: '__setup__', to: 'dev' }],
  }),
  PipelineEdge: () => <div data-testid="edge" />,
  GraphControls: ({ onFitToView }: any) => (
    <button onClick={onFitToView}>fit</button>
  ),
  useHtmlGraphZoom: () => ({
    containerRef: { current: null },
    contentRef: { current: null },
    containerSize: { width: 800, height: 600 },
    zoomIn: jest.fn(),
    zoomOut: jest.fn(),
    fitToView: jest.fn(),
    resetZoom: jest.fn(),
  }),
}));

jest.mock('./ProjectMiniEnvironmentNode', () => ({
  ProjectMiniEnvironmentNode: ({ env, onSelect }: any) => (
    <button onClick={onSelect}>mini-{env.name}</button>
  ),
}));

jest.mock('./ProjectSetupCard', () => ({
  ProjectSetupCard: ({ selected }: any) => (
    <div>setup-card-{String(selected)}</div>
  ),
}));

const environments: ProjectEnvironment[] = [{ name: 'dev' }];

function renderCanvas(overrides: Partial<any> = {}) {
  const props = {
    environments,
    selectedEnvName: null,
    selectedSetup: false,
    onSelectEnv: jest.fn(),
    onSelectSetup: jest.fn(),
    onClearSelection: jest.fn(),
    ...overrides,
  };
  return { props, ...render(<ProjectDeployFlowCanvas {...props} />) };
}

describe('ProjectDeployFlowCanvas', () => {
  it('renders the setup card, env tiles and pipeline edges', () => {
    renderCanvas();
    expect(screen.getByText('setup-card-false')).toBeInTheDocument();
    expect(screen.getByText('mini-dev')).toBeInTheDocument();
    expect(screen.getByTestId('edge')).toBeInTheDocument();
  });

  it('selects the setup tile', () => {
    const { props } = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /select setup/i }));
    expect(props.onSelectSetup).toHaveBeenCalled();
  });

  it('selects an environment tile', () => {
    const { props } = renderCanvas();
    fireEvent.click(screen.getByText('mini-dev'));
    expect(props.onSelectEnv).toHaveBeenCalledWith('dev');
  });

  it('clears the selection on a background click', () => {
    const { props } = renderCanvas();
    fireEvent.click(screen.getByTestId('project-deploy-flow-canvas'));
    expect(props.onClearSelection).toHaveBeenCalled();
  });

  it('renders nothing when there are no environments', () => {
    const { container } = renderCanvas({ environments: [] });
    expect(container).toBeEmptyDOMElement();
  });
});
