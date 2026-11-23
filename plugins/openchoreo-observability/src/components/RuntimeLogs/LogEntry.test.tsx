import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { LogEntry } from './LogEntry';
import { LogEntryField } from './types';
import { LogEntry as LogEntryType } from './types';

// ---- Helpers ----

const allFields = [
  LogEntryField.Timestamp,
  LogEntryField.LogLevel,
  LogEntryField.Log,
];

const sampleLog: LogEntryType = {
  timestamp: '2024-06-01T10:00:00.000Z',
  log: 'Server started on port 8080',
  level: 'INFO',
  metadata: {
    componentName: 'api-service',
    componentUid: 'comp-uid-1',
    projectName: 'my-project',
    projectUid: 'proj-uid-1',
    environmentName: 'development',
    environmentUid: 'env-uid-1',
    podName: 'api-service-abc123',
    podNamespace: 'ns-dev',
    namespaceName: 'ns-dev',
    containerName: 'main',
  },
};

function renderLogEntry(
  overrides: Partial<React.ComponentProps<typeof LogEntry>> = {},
) {
  // Expansion is now controlled by the parent (via useRowExpansion in the
  // real LogsTable); this tiny harness mimics that so the click-to-expand
  // tests below still exercise the round-trip.
  const Harness = () => {
    const [expanded, setExpanded] = useState(false);
    const defaultProps = {
      log: sampleLog,
      selectedFields: allFields,
      environmentName: 'development',
      projectName: 'my-project',
      componentName: 'api-service',
      expanded,
      onToggleExpand: () => setExpanded(prev => !prev),
    };
    return <LogEntry {...defaultProps} {...overrides} />;
  };
  return render(<Harness />);
}

// ---- Tests ----

describe('LogEntry', () => {
  it('renders timestamp when Timestamp field is selected', () => {
    renderLogEntry();

    // Renders formatted timestamp
    expect(
      screen.getByText(new Date('2024-06-01T10:00:00.000Z').toLocaleString()),
    ).toBeInTheDocument();
  });

  it('renders log level chip', () => {
    renderLogEntry();

    expect(screen.getByText('INFO')).toBeInTheDocument();
  });

  it('renders log message', () => {
    renderLogEntry();

    expect(screen.getByText('Server started on port 8080')).toBeInTheDocument();
  });

  it('renders only selected fields', () => {
    renderLogEntry({
      selectedFields: [LogEntryField.Log],
    });

    expect(screen.getByText('Server started on port 8080')).toBeInTheDocument();
    // Timestamp should not be rendered
    expect(
      screen.queryByText(new Date('2024-06-01T10:00:00.000Z').toLocaleString()),
    ).not.toBeInTheDocument();
  });

  it('renders component name when ComponentName field is selected', () => {
    renderLogEntry({
      selectedFields: [...allFields, LogEntryField.ComponentName],
    });

    expect(screen.getByText('api-service')).toBeInTheDocument();
  });

  it('shows the component name as plain text without a logs link builder', () => {
    renderLogEntry({
      selectedFields: [...allFields, LogEntryField.ComponentName],
    });

    expect(screen.queryByRole('link', { name: 'api-service' })).toBeNull();
  });

  it("links the component name to the component's logs", async () => {
    await renderInTestApp(
      <LogEntry
        log={sampleLog}
        selectedFields={[...allFields, LogEntryField.ComponentName]}
        expanded={false}
        onToggleExpand={() => {}}
        getComponentLogsUrl={name =>
          `/catalog/default/component/${name}/runtime-logs?timeRange=1h`
        }
      />,
    );

    expect(screen.getByRole('link', { name: 'api-service' })).toHaveAttribute(
      'href',
      '/catalog/default/component/api-service/runtime-logs?timeRange=1h',
    );
  });

  it("scopes the component link to the entry's release line", async () => {
    const getComponentLogsUrl = jest.fn(
      (name: string, releaseLineName?: string) =>
        `/catalog/default/component/${name}/runtime-logs${
          releaseLineName ? `?releaseLine=${releaseLineName}` : ''
        }`,
    );
    await renderInTestApp(
      <LogEntry
        log={{
          ...sampleLog,
          metadata: { ...sampleLog.metadata, releaseLineName: 'next' },
        }}
        selectedFields={[...allFields, LogEntryField.ComponentName]}
        expanded={false}
        onToggleExpand={() => {}}
        getComponentLogsUrl={getComponentLogsUrl}
      />,
    );

    const link = screen.getByRole('link', { name: 'api-service' });
    expect(getComponentLogsUrl).toHaveBeenCalledWith('api-service', 'next');
    expect(link).toHaveAttribute(
      'href',
      '/catalog/default/component/api-service/runtime-logs?releaseLine=next',
    );
    expect(link).toHaveAttribute('title', 'View logs for api-service (next)');
  });

  it('passes no release line for a main-line entry', async () => {
    const getComponentLogsUrl = jest.fn(
      (name: string) => `/catalog/default/component/${name}/runtime-logs`,
    );
    await renderInTestApp(
      <LogEntry
        log={sampleLog}
        selectedFields={[...allFields, LogEntryField.ComponentName]}
        expanded={false}
        onToggleExpand={() => {}}
        getComponentLogsUrl={getComponentLogsUrl}
      />,
    );

    expect(getComponentLogsUrl).toHaveBeenCalledWith('api-service', undefined);
    expect(screen.getByRole('link', { name: 'api-service' })).toHaveAttribute(
      'title',
      'View logs for api-service',
    );
  });

  it('does not expand the row when the component link is clicked', async () => {
    const user = userEvent.setup();
    const onToggleExpand = jest.fn();
    await renderInTestApp(
      <LogEntry
        log={sampleLog}
        selectedFields={[...allFields, LogEntryField.ComponentName]}
        expanded={false}
        onToggleExpand={onToggleExpand}
        getComponentLogsUrl={name => `/catalog/default/component/${name}`}
      />,
    );

    await user.click(screen.getByRole('link', { name: 'api-service' }));

    expect(onToggleExpand).not.toHaveBeenCalled();
  });

  it('renders the release line when ReleaseLine field is selected', () => {
    renderLogEntry({
      log: {
        ...sampleLog,
        metadata: { ...sampleLog.metadata, releaseLineName: 'canary' },
      },
      selectedFields: [...allFields, LogEntryField.ReleaseLine],
    });

    expect(screen.getByText('canary')).toBeInTheDocument();
  });

  it('names the main line for an entry without a release line', () => {
    renderLogEntry({
      selectedFields: [...allFields, LogEntryField.ReleaseLine],
    });

    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('expands to show metadata on row click', async () => {
    const user = userEvent.setup();
    renderLogEntry();

    // Click the row to expand
    await user.click(screen.getByText('Server started on port 8080'));

    // Should show metadata section
    expect(screen.getByText('Full Log Message')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Environment Name:')).toBeInTheDocument();
    expect(screen.getByText('Pod Name:')).toBeInTheDocument();
    expect(screen.getByText('api-service-abc123')).toBeInTheDocument();
    expect(screen.getByText('Container:')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('collapses metadata on second click', async () => {
    const user = userEvent.setup();
    renderLogEntry();

    // Expand - click the first occurrence (the row cell)
    await user.click(screen.getAllByText('Server started on port 8080')[0]);
    expect(screen.getByText('Full Log Message')).toBeInTheDocument();

    // Collapse - click the first occurrence again
    await user.click(screen.getAllByText('Server started on port 8080')[0]);
    expect(screen.queryByText('Full Log Message')).not.toBeInTheDocument();
  });

  it('stays expanded when clicking inside the expanded panel', async () => {
    const user = userEvent.setup();
    renderLogEntry();

    await user.click(screen.getByText('Server started on port 8080'));
    expect(screen.getByText('Full Log Message')).toBeInTheDocument();

    await user.click(screen.getByText('api-service-abc123'));

    expect(screen.getByText('Full Log Message')).toBeInTheDocument();
  });

  it('renders ERROR level chip', () => {
    renderLogEntry({
      log: { ...sampleLog, level: 'ERROR' },
    });

    expect(screen.getByText('ERROR')).toBeInTheDocument();
  });

  it('renders WARN level chip', () => {
    renderLogEntry({
      log: { ...sampleLog, level: 'WARN' },
    });

    expect(screen.getByText('WARN')).toBeInTheDocument();
  });

  it('renders DEBUG level chip', () => {
    renderLogEntry({
      log: { ...sampleLog, level: 'DEBUG' },
    });

    expect(screen.getByText('DEBUG')).toBeInTheDocument();
  });

  it('shows copy button on log cell', () => {
    renderLogEntry();

    expect(screen.getByTitle('Copy log message')).toBeInTheDocument();
  });

  it('falls back to prop values when metadata is missing', async () => {
    const user = userEvent.setup();
    renderLogEntry({
      log: {
        ...sampleLog,
        metadata: undefined,
      },
      environmentName: 'staging',
      projectName: 'fallback-project',
      componentName: 'fallback-component',
    });

    // Expand to see metadata
    await user.click(screen.getByText('Server started on port 8080'));

    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('fallback-project')).toBeInTheDocument();
    expect(screen.getByText('fallback-component')).toBeInTheDocument();
  });
});
