import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformLogEntryRow } from './PlatformLogEntryRow';
import { DEFAULT_PLATFORM_LOG_FIELDS, PlatformLogEntry } from './types';

const fullLog: PlatformLogEntry = {
  timestamp: '2026-08-14T16:31:00.000Z',
  log: 'reconcile failed',
  level: 'ERROR',
  clusterInstance: 'cluster1',
  namespaceName: 'openchoreo-control-plane',
  podName: 'controller-manager-7f58b689b5-pwsb5',
  containerName: 'manager',
  podIp: '10.0.0.7',
  nodeName: 'k3d-openchoreo-server-0',
  containerImage: 'ghcr.io/openchoreo/controller:latest-dev',
  labels: {
    'openchoreo.dev/plane': 'controlplane',
    'app.kubernetes.io/name': 'openchoreo-control-plane',
  },
};

const renderRow = (
  log: PlatformLogEntry = fullLog,
  expanded = false,
  onToggleExpand = jest.fn(),
) =>
  render(
    <PlatformLogEntryRow
      log={log}
      selectedFields={DEFAULT_PLATFORM_LOG_FIELDS}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />,
  );

describe('PlatformLogEntryRow', () => {
  it('shows no metadata panel while collapsed', () => {
    renderRow(fullLog, false);

    expect(screen.queryByText('Metadata')).not.toBeInTheDocument();
    expect(screen.queryByText('Pod Labels')).not.toBeInTheDocument();
  });

  it('reveals pod coordinates when expanded', () => {
    renderRow(fullLog, true);

    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.7')).toBeInTheDocument();
    expect(screen.getByText('k3d-openchoreo-server-0')).toBeInTheDocument();
    expect(
      screen.getByText('ghcr.io/openchoreo/controller:latest-dev'),
    ).toBeInTheDocument();
  });

  // The labels are why the panel exists: you filter by one, then need to see the rest.
  // They must render with the Kubernetes spelling so a key can be pasted into the filter.
  it('lists pod labels with their Kubernetes keys', () => {
    renderRow(fullLog, true);

    expect(screen.getByText('Pod Labels')).toBeInTheDocument();
    expect(screen.getByText('openchoreo.dev/plane:')).toBeInTheDocument();
    expect(screen.getByText('controlplane')).toBeInTheDocument();
    expect(screen.getByText('app.kubernetes.io/name:')).toBeInTheDocument();
  });

  it('sorts labels so rows stay comparable', () => {
    renderRow(fullLog, true);

    const keys = screen
      .getAllByText(/^(openchoreo\.dev|app\.kubernetes\.io)\//)
      .map(el => el.textContent);
    expect(keys).toEqual(['app.kubernetes.io/name:', 'openchoreo.dev/plane:']);
  });

  // Records predating the collector change carry no cluster stamp, and not every
  // backend supplies every field — an absent one is omitted, not shown blank.
  it('omits fields the record does not carry', () => {
    renderRow(
      {
        timestamp: '2026-08-14T16:31:00.000Z',
        log: 'sparse record',
        namespaceName: 'openchoreo-control-plane',
      },
      true,
    );

    expect(screen.getByText('Namespace:')).toBeInTheDocument();
    expect(screen.queryByText('Cluster:')).not.toBeInTheDocument();
    expect(screen.queryByText('Pod IP:')).not.toBeInTheDocument();
    expect(screen.queryByText('Pod Labels')).not.toBeInTheDocument();
  });

  it('toggles expansion when the row is clicked', async () => {
    const onToggleExpand = jest.fn();
    renderRow(fullLog, false, onToggleExpand);

    await userEvent.click(screen.getByText('reconcile failed'));

    expect(onToggleExpand).toHaveBeenCalled();
  });
});
