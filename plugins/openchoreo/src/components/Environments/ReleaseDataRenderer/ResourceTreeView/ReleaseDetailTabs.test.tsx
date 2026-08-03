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
      spec: {
        environmentName: 'development',
        owner: { projectName: 'my-project', componentName: 'my-component' },
      },
      status: {
        conditions: [
          {
            type: 'ResourcesApplied',
            status: 'True',
            reason: 'ApplySucceeded',
            message: 'All resources applied successfully',
            lastTransitionTime: '2025-01-01T00:00:00Z',
          },
        ],
      },
    },
    x: 0,
    y: 0,
    width: 200,
    height: 50,
    ...overrides,
  };
}

describe('ReleaseDetailTabs', () => {
  it('shows the release conditions on the default (Summary) tab', () => {
    render(<ReleaseDetailTabs node={makeReleaseNode()} />);

    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByText('ResourcesApplied')).toBeInTheDocument();
    expect(screen.getByText('ApplySucceeded')).toBeInTheDocument();
    expect(
      screen.getByText('All resources applied successfully'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('yaml-viewer')).not.toBeInTheDocument();
  });

  it('surfaces a failed apply to the target plane in the conditions table', () => {
    render(
      <ReleaseDetailTabs
        node={makeReleaseNode({
          specObject: {
            status: {
              conditions: [
                {
                  type: 'ResourcesApplied',
                  status: 'False',
                  reason: 'ApplyFailed',
                  message:
                    'Failed to apply resources to target plane: admission webhook denied the request',
                },
              ],
            },
          },
        })}
      />,
    );

    expect(screen.getByText('ApplyFailed')).toBeInTheDocument();
    expect(screen.getByText(/admission webhook denied/)).toBeInTheDocument();
  });

  it('does not style an Unknown condition as a failure', () => {
    const { container } = render(
      <ReleaseDetailTabs
        node={makeReleaseNode({
          specObject: {
            status: {
              conditions: [
                {
                  type: 'ResourcesApplied',
                  status: 'Unknown',
                  reason: 'Progressing',
                },
              ],
            },
          },
        })}
      />,
    );

    // An indeterminate condition reads as progressing, not as a failure.
    expect(
      container.querySelector('[class*="degraded"]'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[class*="progressing"]'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows the owning project, component and environment on the Summary tab', () => {
    render(<ReleaseDetailTabs node={makeReleaseNode()} />);

    expect(screen.getByText('my-project')).toBeInTheDocument();
    expect(screen.getByText('my-component')).toBeInTheDocument();
    expect(screen.getByText('development')).toBeInTheDocument();
  });

  it('omits the conditions table when the release reports no conditions', () => {
    render(
      <ReleaseDetailTabs node={makeReleaseNode({ specObject: undefined })} />,
    );

    expect(screen.queryByText('Conditions')).not.toBeInTheDocument();
  });

  it('renders the release definition as YAML on the Definition tab', async () => {
    render(<ReleaseDetailTabs node={makeReleaseNode()} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Definition' }));

    expect(screen.getByTestId('yaml-viewer')).toHaveTextContent(
      'kind: RenderedRelease',
    );
    expect(screen.queryByText('Conditions')).not.toBeInTheDocument();
  });

  it('shows an empty state on the Definition tab when no definition is available', async () => {
    render(
      <ReleaseDetailTabs node={makeReleaseNode({ specObject: undefined })} />,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Definition' }));

    expect(
      screen.getByText('No release definition available'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('yaml-viewer')).not.toBeInTheDocument();
  });

  it('surfaces the target plane as a chip when present', () => {
    render(<ReleaseDetailTabs node={makeReleaseNode()} />);

    expect(screen.getByText('Target: dataplane')).toBeInTheDocument();
  });

  it('omits the target plane chip when the node has none', () => {
    render(
      <ReleaseDetailTabs node={makeReleaseNode({ targetPlane: undefined })} />,
    );

    expect(screen.queryByText(/^Target:/)).not.toBeInTheDocument();
  });
});
