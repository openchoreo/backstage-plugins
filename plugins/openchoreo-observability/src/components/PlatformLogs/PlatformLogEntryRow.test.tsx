import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformLogEntryRow } from './PlatformLogEntryRow';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PlatformLogEntry,
  PlatformLogsFilters,
} from './types';

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

  describe('adding values to the filters', () => {
    const applied: Pick<
      PlatformLogsFilters,
      | 'clusterInstances'
      | 'namespaces'
      | 'podNames'
      | 'containerNames'
      | 'labels'
    > = {
      clusterInstances: [],
      namespaces: [],
      podNames: ['other-pod'],
      containerNames: [],
      labels: 'openchoreo.dev/plane=controlplane',
    };

    const renderFilterable = (
      onFiltersChange = jest.fn(),
      onToggleExpand = jest.fn(),
      filters = applied,
    ) =>
      render(
        <PlatformLogEntryRow
          log={fullLog}
          selectedFields={DEFAULT_PLATFORM_LOG_FIELDS}
          expanded
          onToggleExpand={onToggleExpand}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />,
      );

    it('appends a clicked pod to the pods already selected', async () => {
      const onFiltersChange = jest.fn();
      const onToggleExpand = jest.fn();
      renderFilterable(onFiltersChange, onToggleExpand);

      await userEvent.click(
        screen.getByRole('button', {
          name: 'controller-manager-7f58b689b5-pwsb5',
        }),
      );

      expect(onFiltersChange).toHaveBeenCalledWith({
        podNames: ['other-pod', 'controller-manager-7f58b689b5-pwsb5'],
      });
      // The click is on the panel, not the row; it must not fold the panel away.
      expect(onToggleExpand).not.toHaveBeenCalled();
    });

    it('ANDs a clicked label onto the selector', async () => {
      const onFiltersChange = jest.fn();
      renderFilterable(onFiltersChange);

      await userEvent.click(
        screen.getByTitle(
          'Filter by app.kubernetes.io/name=openchoreo-control-plane',
        ),
      );

      expect(onFiltersChange).toHaveBeenCalledWith({
        labels:
          'openchoreo.dev/plane=controlplane,app.kubernetes.io/name=openchoreo-control-plane',
      });
    });

    it('disables values that are already applied', () => {
      renderFilterable(jest.fn(), jest.fn(), {
        ...applied,
        podNames: ['controller-manager-7f58b689b5-pwsb5'],
      });

      expect(
        screen.getByRole('button', {
          name: 'controller-manager-7f58b689b5-pwsb5',
        }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'controlplane' }),
      ).toBeDisabled();
    });

    // Node, pod IP and image have no filter; a button would promise a query the page
    // cannot send.
    it('leaves fields without a filter as plain text', () => {
      renderFilterable();

      for (const value of [
        'k3d-openchoreo-server-0',
        '10.0.0.7',
        'ghcr.io/openchoreo/controller:latest-dev',
      ]) {
        expect(
          screen.queryByRole('button', { name: value }),
        ).not.toBeInTheDocument();
      }
    });
  });

  it('shows values as plain text when the row cannot change the filters', () => {
    renderRow(fullLog, true);

    expect(
      screen.queryByRole('button', { name: 'manager' }),
    ).not.toBeInTheDocument();
  });
});
