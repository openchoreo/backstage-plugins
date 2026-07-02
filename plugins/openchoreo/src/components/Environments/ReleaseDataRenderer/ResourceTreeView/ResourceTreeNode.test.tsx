import { render, screen } from '@testing-library/react';
import { ResourceTreeNode } from './ResourceTreeNode';
import type { LayoutNode } from './treeTypes';

function makeNode(overrides: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id: 'node-1',
    kind: 'RenderedRelease',
    name: 'my-release',
    targetPlane: 'dataplane',
    parentIds: [],
    x: 0,
    y: 0,
    width: 200,
    height: 50,
    ...overrides,
  };
}

describe('ResourceTreeNode', () => {
  const defaultProps = {
    isSelected: false,
    onClick: jest.fn(),
  };

  it('shows the target plane subtitle for a RenderedRelease node', () => {
    render(<ResourceTreeNode {...defaultProps} node={makeNode()} />);

    expect(screen.getByText('Target plane: dataplane')).toBeInTheDocument();
  });

  it('omits the target plane subtitle when targetPlane is absent', () => {
    render(
      <ResourceTreeNode
        {...defaultProps}
        node={makeNode({ targetPlane: undefined })}
      />,
    );

    expect(screen.queryByText(/^Target plane:/)).not.toBeInTheDocument();
  });

  it('does not show the target plane subtitle for non-release kinds', () => {
    render(
      <ResourceTreeNode
        {...defaultProps}
        node={makeNode({ kind: 'Deployment' })}
      />,
    );

    expect(screen.queryByText(/^Target plane:/)).not.toBeInTheDocument();
  });
});
