import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceDetailTabs } from './ResourceDetailTabs';
import type { ExecContext, LayoutNode } from './treeTypes';

// Isolate the tab container from data-fetching / session children.
jest.mock('./ResourceEventsTable', () => ({
  ResourceEventsTable: () => <div data-testid="events-table" />,
}));
jest.mock('./ResourcePodLogsViewer', () => ({
  ResourcePodLogsViewer: () => <div data-testid="logs-viewer" />,
}));
jest.mock('./ResourcePodTerminalViewer', () => ({
  ResourcePodTerminalViewer: (props: {
    podName?: string;
    containers?: string[];
  }) => (
    <div
      data-testid="terminal-viewer"
      data-pod={props.podName}
      data-containers={(props.containers ?? []).join(',')}
    />
  ),
}));
jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => <pre>{value}</pre>,
}));

const execContext: ExecContext = {
  namespaceName: 'default',
  projectName: 'default',
  componentName: 'greeter-service',
  environmentName: 'development',
  environmentDisplayName: 'Development',
  entityRef: 'component:default/greeter-service',
};

function makeNode(overrides: Partial<LayoutNode>): LayoutNode {
  return {
    id: 'n',
    kind: 'Pod',
    name: 'greeter-pod',
    parentIds: [],
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    ...overrides,
  };
}

const podNode = makeNode({
  kind: 'Pod',
  name: 'greeter-pod',
  specObject: {
    spec: { containers: [{ name: 'main' }, { name: 'sidecar' }] },
  },
});

describe('ResourceDetailTabs — Terminal tab', () => {
  const baseProps = {
    namespaceName: 'default',
    releaseBindingName: 'greeter-service-development',
  };

  it('shows a Terminal tab for a Pod node when execContext is provided', async () => {
    const user = userEvent.setup();
    render(
      <ResourceDetailTabs
        {...baseProps}
        node={podNode}
        execContext={execContext}
      />,
    );

    const terminalTab = screen.getByText('Terminal');
    expect(terminalTab).toBeInTheDocument();

    await user.click(terminalTab);
    const viewer = screen.getByTestId('terminal-viewer');
    expect(viewer).toHaveAttribute('data-pod', 'greeter-pod');
    expect(viewer).toHaveAttribute('data-containers', 'main,sidecar');
  });

  it('hides the Terminal tab for a Pod node without execContext', () => {
    render(<ResourceDetailTabs {...baseProps} node={podNode} />);
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('does not show a Terminal tab for non-Pod nodes', () => {
    const deploymentNode = makeNode({ kind: 'Deployment', name: 'dep' });
    render(
      <ResourceDetailTabs
        {...baseProps}
        node={deploymentNode}
        execContext={execContext}
      />,
    );
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
  });
});
