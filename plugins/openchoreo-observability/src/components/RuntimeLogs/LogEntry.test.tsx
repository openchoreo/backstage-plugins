import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    return (
      <MemoryRouter>
        <LogEntry {...defaultProps} {...overrides} />
      </MemoryRouter>
    );
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

  it('renders component name link with correct path', () => {
    renderLogEntry({
      selectedFields: [...allFields, LogEntryField.ComponentName],
      entityNamespace: 'my-namespace',
      entityKind: 'Component',
    });

    const link = screen.getByRole('link', { name: 'api-service' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      '/catalog/my-namespace/component/api-service/runtime-logs',
    );
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

  it('navigates to component runtime logs and stops propagation on component name link click', async () => {
    const user = userEvent.setup();
    const onToggleExpand = jest.fn();

    const LocationDisplay = () => {
      const location = useLocation();
      return <span data-testid="location-path">{location.pathname}</span>;
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <LogEntry
          log={sampleLog}
          selectedFields={[...allFields, LogEntryField.ComponentName]}
          environmentName="development"
          projectName="my-project"
          componentName="api-service"
          expanded={false}
          onToggleExpand={onToggleExpand}
        />
        <LocationDisplay />
      </MemoryRouter>,
    );

    // Assert initial location is '/'
    expect(screen.getByTestId('location-path')).toHaveTextContent('/');

    const link = screen.getByRole('link', { name: 'api-service' });
    await user.click(link);

    // Assert the location updated to runtime-logs path
    expect(screen.getByTestId('location-path')).toHaveTextContent(
      '/catalog/default/component/api-service/runtime-logs',
    );

    // Assert propagation was stopped (onToggleExpand was NOT called)
    expect(onToggleExpand).not.toHaveBeenCalled();
  });
});
