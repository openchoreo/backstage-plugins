import { render, screen } from '@testing-library/react';
import { ReleaseStatusBar } from './ReleaseStatusBar';
import type { ResourceTreeData, ResourceTreeNode } from '../types';

// Mock design-system StatusBadge to expose props as text
jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ label, status }: { label: string; status: string }) => (
    <span data-testid="status-badge" data-status={status}>
      {label}
    </span>
  ),
}));

// ---- Helpers ----

function makeNode(
  overrides: Partial<ResourceTreeNode> & {
    uid: string;
    kind: string;
    name: string;
  },
): ResourceTreeNode {
  return {
    version: 'v1',
    namespace: 'default',
    resourceVersion: '1',
    createdAt: '2026-01-01T00:00:00Z',
    object: {},
    health: { status: 'Healthy' },
    ...overrides,
  };
}

function makeTreeData(nodes: ResourceTreeNode[]): ResourceTreeData {
  return {
    renderedReleases: [{ name: 'release', targetPlane: 'dp', nodes }],
  };
}

// ---- Tests ----

describe('ReleaseStatusBar', () => {
  describe('health section', () => {
    it('shows Healthy for legacy Ready status', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{ status: 'Ready' }}
        />,
      );

      const badge = screen.getByTestId('status-badge');
      expect(badge).toHaveTextContent('Healthy');
    });

    it('shows Degraded for legacy Failed status', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{ status: 'Failed' }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent('Degraded');
    });

    it('shows Progressing for legacy NotReady status', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{ status: 'NotReady' }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(
        'Progressing',
      );
    });

    it('shows Undeployed for legacy NotReady with ResourcesUndeployed reason', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{
            status: 'NotReady',
            statusReason: 'ResourcesUndeployed',
          }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(
        'Undeployed',
      );
    });

    it('shows reason and message when present (legacy)', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{
            status: 'Failed',
            statusReason: 'DeployFailed',
            statusMessage: 'OOM killed',
          }}
        />,
      );

      expect(screen.getByText('Reason: DeployFailed')).toBeInTheDocument();
      expect(screen.getByText('OOM killed')).toBeInTheDocument();
    });

    it('shows Healthy for new API Ready=True condition', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
          }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent('Healthy');
    });

    it('shows Degraded for new API Ready=False condition', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{
            status: { conditions: [{ type: 'Ready', status: 'False' }] },
          }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent('Degraded');
    });

    it('shows Undeployed for new API Ready=False with ResourcesUndeployed', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{
            status: {
              conditions: [
                {
                  type: 'Ready',
                  status: 'False',
                  reason: 'ResourcesUndeployed',
                },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(
        'Undeployed',
      );
    });

    it('shows Progressing for new API Ready=Unknown condition', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={{
            status: { conditions: [{ type: 'Ready', status: 'Unknown' }] },
          }}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent(
        'Progressing',
      );
    });

    it('shows Unknown when no binding data', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
        />,
      );

      expect(screen.getByTestId('status-badge')).toHaveTextContent('Unknown');
    });
  });

  describe('resources section', () => {
    it('shows "No Resources" when tree has no nodes', () => {
      render(
        <ReleaseStatusBar resourceTreeData={{}} releaseBindingData={null} />,
      );

      expect(screen.getByText('No Resources')).toBeInTheDocument();
    });

    it('shows singular "1 resource" for a single node', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
          ])}
          releaseBindingData={null}
        />,
      );

      expect(screen.getByText('1 resource')).toBeInTheDocument();
    });

    it('shows plural "N resources" for multiple nodes', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({ uid: '1', kind: 'Deployment', name: 'dep' }),
            makeNode({ uid: '2', kind: 'Service', name: 'svc' }),
            makeNode({ uid: '3', kind: 'Pod', name: 'pod' }),
          ])}
          releaseBindingData={null}
        />,
      );

      expect(screen.getByText('3 resources')).toBeInTheDocument();
    });

    it('shows health breakdown with counts per status', () => {
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({
              uid: '1',
              kind: 'Deployment',
              name: 'dep',
              health: { status: 'Healthy' },
            }),
            makeNode({
              uid: '2',
              kind: 'Service',
              name: 'svc',
              health: { status: 'Healthy' },
            }),
            makeNode({
              uid: '3',
              kind: 'Pod',
              name: 'pod',
              health: { status: 'Degraded' },
            }),
          ])}
          releaseBindingData={null}
        />,
      );

      // formatResourceBreakdown uses · separator and orders: Healthy, Progressing, Suspended, Degraded, Undeployed, Unknown
      expect(screen.getByText(/2 Healthy/)).toBeInTheDocument();
      expect(screen.getByText(/1 Degraded/)).toBeInTheDocument();
    });
  });

  describe('last updated section', () => {
    it('shows N/A when no nodes exist', () => {
      render(
        <ReleaseStatusBar resourceTreeData={{}} releaseBindingData={null} />,
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('shows relative time for recent nodes', () => {
      // Set createdAt to a known time in the past
      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();
      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({
              uid: '1',
              kind: 'Deployment',
              name: 'dep',
              createdAt: twoHoursAgo,
            }),
          ])}
          releaseBindingData={null}
        />,
      );

      expect(screen.getByText('2 hours ago')).toBeInTheDocument();
    });

    it('picks the latest createdAt among multiple nodes', () => {
      const oneHourAgo = new Date(
        Date.now() - 1 * 60 * 60 * 1000,
      ).toISOString();
      const threeDaysAgo = new Date(
        Date.now() - 3 * 24 * 60 * 60 * 1000,
      ).toISOString();

      render(
        <ReleaseStatusBar
          resourceTreeData={makeTreeData([
            makeNode({
              uid: '1',
              kind: 'Deployment',
              name: 'dep',
              createdAt: threeDaysAgo,
            }),
            makeNode({
              uid: '2',
              kind: 'Service',
              name: 'svc',
              createdAt: oneHourAgo,
            }),
          ])}
          releaseBindingData={null}
        />,
      );

      // Should show "1 hour ago" (the most recent), not "3 days ago"
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });
  });
});
