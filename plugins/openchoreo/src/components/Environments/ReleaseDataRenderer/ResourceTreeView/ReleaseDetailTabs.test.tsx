import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReleaseDetailTabs } from './ReleaseDetailTabs';
import type { LayoutNode } from './treeTypes';

// Mock design-system YamlViewer
jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
}));

// Mock the events table to isolate the tab container logic
jest.mock('./ResourceEventsTable', () => ({
  ResourceEventsTable: ({
    node,
    refreshKey,
  }: {
    node: { name: string };
    refreshKey?: number;
  }) => (
    <div data-testid="resource-events-table">
      {node.name}:{refreshKey ?? 0}
    </div>
  ),
}));

function makeReleaseNode(overrides: Partial<LayoutNode> = {}): LayoutNode {
  return {
    id: '__release__my-release',
    kind: 'RenderedRelease',
    name: 'my-release',
    group: 'openchoreo.dev',
    version: 'v1alpha1',
    targetPlane: 'dataplane',
    parentIds: ['__release_binding__'],
    specObject: {
      apiVersion: 'openchoreo.dev/v1alpha1',
      kind: 'RenderedRelease',
    },
    x: 0,
    y: 0,
    width: 200,
    height: 50,
    ...overrides,
  };
}

describe('ReleaseDetailTabs', () => {
  const defaultProps = {
    namespaceName: 'default-ns',
    releaseBindingName: 'rb-name',
  };

  it('shows the events table on the default (Events) tab', () => {
    render(<ReleaseDetailTabs {...defaultProps} node={makeReleaseNode()} />);

    expect(screen.getByTestId('resource-events-table')).toHaveTextContent(
      'my-release:0',
    );
    expect(screen.queryByTestId('yaml-viewer')).not.toBeInTheDocument();
  });

  it('renders the release spec as YAML on the Spec tab', async () => {
    render(<ReleaseDetailTabs {...defaultProps} node={makeReleaseNode()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Spec' }));

    const viewer = screen.getByTestId('yaml-viewer');
    expect(viewer).toHaveTextContent('kind: RenderedRelease');
    expect(
      screen.queryByTestId('resource-events-table'),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state on the Spec tab when no spec is available', async () => {
    render(
      <ReleaseDetailTabs
        {...defaultProps}
        node={makeReleaseNode({ specObject: undefined })}
      />,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Spec' }));

    expect(screen.getByText('No release spec available')).toBeInTheDocument();
    expect(screen.queryByTestId('yaml-viewer')).not.toBeInTheDocument();
  });

  it('surfaces the target plane as a chip when present', () => {
    render(<ReleaseDetailTabs {...defaultProps} node={makeReleaseNode()} />);

    expect(screen.getByText('Target: dataplane')).toBeInTheDocument();
  });

  it('omits the target plane chip when the node has none', () => {
    render(
      <ReleaseDetailTabs
        {...defaultProps}
        node={makeReleaseNode({ targetPlane: undefined })}
      />,
    );

    expect(screen.queryByText(/^Target:/)).not.toBeInTheDocument();
  });

  it('bumps the events refresh key when the refresh button is clicked', async () => {
    render(<ReleaseDetailTabs {...defaultProps} node={makeReleaseNode()} />);

    expect(screen.getByTestId('resource-events-table')).toHaveTextContent(
      'my-release:0',
    );

    // The only role="button" in the Events tab is the refresh icon button
    // (tabs use role="tab").
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('resource-events-table')).toHaveTextContent(
      'my-release:1',
    );
  });
});
