import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApiProvider } from '@backstage/test-utils';
import {
  createMockOpenChoreoClient,
  type MockOpenChoreoClient,
} from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import type { PodLogEntry } from '../../../../api/OpenChoreoClientApi';
import { ResourcePodLogsViewer } from './ResourcePodLogsViewer';
import type { LayoutNode } from './treeTypes';

const podNode = (name: string, containers: string[]) =>
  ({
    name,
    specObject: { spec: { containers: containers.map(c => ({ name: c })) } },
  } as unknown as LayoutNode);

const renderViewer = (mockClient: MockOpenChoreoClient, node: LayoutNode) =>
  render(
    <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
      <ResourcePodLogsViewer
        node={node}
        namespaceName="ns-1"
        releaseBindingName="rb-1"
      />
    </TestApiProvider>,
  );

const podLogs = (entries: PodLogEntry[]) => ({ logEntries: entries });

describe('ResourcePodLogsViewer', () => {
  it('shows a container dropdown and filters logs by container', async () => {
    const mockClient = createMockOpenChoreoClient();
    mockClient.fetchPodLogs.mockResolvedValue(
      podLogs([
        {
          timestamp: '2026-01-01T00:00:00Z',
          log: 'main started',
          container: 'main',
        },
        {
          timestamp: '2026-01-01T00:00:01Z',
          log: 'sidecar heartbeat',
          container: 'log-sidecar',
        },
      ]),
    );

    renderViewer(mockClient, podNode('pod-1', ['main', 'log-sidecar']));

    // Both containers' lines are visible initially.
    expect(await screen.findByText('main started')).toBeInTheDocument();
    expect(screen.getByText('sidecar heartbeat')).toBeInTheDocument();

    // Open the container dropdown and pick a single container.
    await userEvent.click(screen.getByRole('button', { name: /container/i }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'log-sidecar' }),
    );

    await waitFor(() => {
      expect(screen.queryByText('main started')).not.toBeInTheDocument();
    });
    expect(screen.getByText('sidecar heartbeat')).toBeInTheDocument();
  });

  it('shows no container dropdown for a single-container pod', async () => {
    const mockClient = createMockOpenChoreoClient();
    mockClient.fetchPodLogs.mockResolvedValue(
      podLogs([
        {
          timestamp: '2026-01-01T00:00:00Z',
          log: 'solo log',
          container: 'main',
        },
      ]),
    );

    renderViewer(mockClient, podNode('pod-2', ['main']));

    expect(await screen.findByText('solo log')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /container/i }),
    ).not.toBeInTheDocument();
  });
});
