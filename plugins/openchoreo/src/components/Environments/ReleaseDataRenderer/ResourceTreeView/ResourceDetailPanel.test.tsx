import { render, screen } from '@testing-library/react';
import { ResourceDetailPanel } from './ResourceDetailPanel';
import type { LayoutNode } from './treeTypes';

// Mock child components to isolate panel logic
jest.mock('./ReleaseBindingDetailTabs', () => ({
  ReleaseBindingDetailTabs: ({
    releaseBindingData,
  }: {
    releaseBindingData: unknown;
  }) => (
    <div data-testid="release-binding-detail-tabs">
      {releaseBindingData ? 'has-data' : 'no-data'}
    </div>
  ),
}));

jest.mock('./ResourceDetailTabs', () => ({
  ResourceDetailTabs: ({ node }: { node: { kind: string; name: string } }) => (
    <div data-testid="resource-detail-tabs">
      {node.kind}/{node.name}
    </div>
  ),
}));

jest.mock('./ResourceKindIcon', () => ({
  ResourceKindIcon: ({ kind }: { kind: string }) => (
    <span data-testid="kind-icon">{kind}</span>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({}));

// ---- Helpers ----

function makeLayoutNode(overrides: Partial<LayoutNode>): LayoutNode {
  return {
    id: 'test-node',
    kind: 'Deployment',
    name: 'test-name',
    parentIds: [],
    x: 0,
    y: 0,
    width: 200,
    height: 50,
    ...overrides,
  };
}

// ---- Tests ----

describe('ResourceDetailPanel', () => {
  const defaultProps = {
    onClose: jest.fn(),
    releaseBindingData: null,
    namespaceName: 'default-ns',
    releaseBindingName: 'rb-name',
  };

  it('renders nothing visible when node is null (drawer closed)', () => {
    const { container } = render(
      <ResourceDetailPanel {...defaultProps} node={null} />,
    );

    // Drawer should not render content
    expect(screen.queryByTestId('kind-icon')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it('renders header with kind icon and node name', () => {
    const node = makeLayoutNode({
      kind: 'Deployment',
      name: 'nginx',
    });

    render(<ResourceDetailPanel {...defaultProps} node={node} />);

    expect(screen.getByTestId('kind-icon')).toHaveTextContent('Deployment');
    expect(screen.getByText('nginx')).toBeInTheDocument();
  });

  it('renders close button', () => {
    const node = makeLayoutNode({ kind: 'Deployment', name: 'dep' });

    render(<ResourceDetailPanel {...defaultProps} node={node} />);

    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  describe('metadata chips', () => {
    it('shows namespace chip when namespace is present', () => {
      const node = makeLayoutNode({ namespace: 'my-namespace' });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.getByText('my-namespace')).toBeInTheDocument();
    });

    it('shows health status chip when healthStatus is present', () => {
      const node = makeLayoutNode({ healthStatus: 'Healthy' });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.getByText('Healthy')).toBeInTheDocument();
    });

    it('shows API group/version chip', () => {
      const node = makeLayoutNode({ group: 'apps', version: 'v1' });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.getByText('apps/v1')).toBeInTheDocument();
    });

    it('shows only version when group is absent', () => {
      const node = makeLayoutNode({ group: undefined, version: 'v1' });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.getByText('v1')).toBeInTheDocument();
    });
  });

  describe('content routing', () => {
    it('renders ReleaseBindingDetailTabs for root node', () => {
      const node = makeLayoutNode({
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
      });

      render(
        <ResourceDetailPanel
          {...defaultProps}
          node={node}
          releaseBindingData={{ status: 'Ready' }}
        />,
      );

      expect(
        screen.getByTestId('release-binding-detail-tabs'),
      ).toHaveTextContent('has-data');
      expect(
        screen.queryByTestId('resource-detail-tabs'),
      ).not.toBeInTheDocument();
    });

    it('renders release name and target plane for RenderedRelease node', () => {
      const node = makeLayoutNode({
        kind: 'RenderedRelease',
        name: 'my-release',
        version: 'dataplane-1',
        isRoot: false,
      });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.getByText('Release Name')).toBeInTheDocument();
      // "my-release" appears in header and body
      expect(screen.getAllByText('my-release')).toHaveLength(2);
      expect(screen.getByText('Target Plane')).toBeInTheDocument();
      // "dataplane-1" appears in metadata chip (version) and in body text
      expect(screen.getAllByText('dataplane-1').length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it('renders ResourceDetailTabs for regular resource nodes', () => {
      const node = makeLayoutNode({
        kind: 'Deployment',
        name: 'nginx',
        isRoot: false,
      });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.getByTestId('resource-detail-tabs')).toHaveTextContent(
        'Deployment/nginx',
      );
    });

    it('does not render ResourceDetailTabs for root node', () => {
      const node = makeLayoutNode({
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
      });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(
        screen.queryByTestId('resource-detail-tabs'),
      ).not.toBeInTheDocument();
    });

    it('does not render RenderedRelease content for non-RenderedRelease kinds', () => {
      const node = makeLayoutNode({
        kind: 'Service',
        name: 'svc',
        isRoot: false,
      });

      render(<ResourceDetailPanel {...defaultProps} node={node} />);

      expect(screen.queryByText('Release Name')).not.toBeInTheDocument();
      expect(screen.queryByText('Target Plane')).not.toBeInTheDocument();
    });
  });
});
