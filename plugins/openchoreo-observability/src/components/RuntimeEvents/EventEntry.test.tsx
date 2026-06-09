import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableBody } from '@material-ui/core';
import { EventEntry } from './EventEntry';
import { EventEntryField, EventEntry as EventEntryType } from './types';

// ---- Helpers ----

const allFields = [
  EventEntryField.Timestamp,
  EventEntryField.Type,
  EventEntryField.Reason,
  EventEntryField.Object,
  EventEntryField.Message,
];

const sampleEvent: EventEntryType = {
  timestamp: '2024-06-01T10:00:00.000Z',
  message: 'Scaled up replica set to 3',
  type: 'Normal',
  reason: 'ScalingReplicaSet',
  metadata: {
    objectKind: 'Deployment',
    objectName: 'api-service',
    objectNamespace: 'ns-dev',
    componentName: 'api-service',
    componentUid: 'comp-uid-1',
    projectName: 'my-project',
    projectUid: 'proj-uid-1',
    environmentName: 'development',
    environmentUid: 'env-uid-1',
    namespaceName: 'ns-dev',
  },
};

function renderEventEntry(
  overrides: Partial<React.ComponentProps<typeof EventEntry>> = {},
) {
  const defaultProps = {
    event: sampleEvent,
    selectedFields: allFields,
    environmentName: 'development',
    projectName: 'my-project',
    componentName: 'api-service',
  };

  return render(
    <Table>
      <TableBody>
        <EventEntry {...defaultProps} {...overrides} />
      </TableBody>
    </Table>,
  );
}

// ---- Tests ----

describe('EventEntry', () => {
  it('renders the formatted timestamp when Timestamp is selected', () => {
    renderEventEntry();

    expect(
      screen.getByText(new Date('2024-06-01T10:00:00.000Z').toLocaleString()),
    ).toBeInTheDocument();
  });

  it('renders the type chip', () => {
    renderEventEntry();
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('renders a Warning type chip', () => {
    renderEventEntry({ event: { ...sampleEvent, type: 'Warning' } });
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders the reason', () => {
    renderEventEntry();
    expect(screen.getByText('ScalingReplicaSet')).toBeInTheDocument();
  });

  it('renders the object reference as kind/name', () => {
    renderEventEntry();
    expect(screen.getByText('Deployment/api-service')).toBeInTheDocument();
  });

  it('renders the message', () => {
    renderEventEntry();
    expect(screen.getByText('Scaled up replica set to 3')).toBeInTheDocument();
  });

  it('renders only the selected fields', () => {
    renderEventEntry({ selectedFields: [EventEntryField.Message] });

    expect(screen.getByText('Scaled up replica set to 3')).toBeInTheDocument();
    expect(
      screen.queryByText(new Date('2024-06-01T10:00:00.000Z').toLocaleString()),
    ).not.toBeInTheDocument();
  });

  it('shows the copy button on the message cell', () => {
    renderEventEntry();
    expect(screen.getByTitle('Copy event message')).toBeInTheDocument();
  });

  it('expands to show metadata on row click', async () => {
    const user = userEvent.setup();
    renderEventEntry();

    await user.click(screen.getByText('Scaled up replica set to 3'));

    expect(screen.getByText('Event Message')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('Object Kind:')).toBeInTheDocument();
    expect(screen.getByText('Object Name:')).toBeInTheDocument();
    expect(screen.getByText('Environment Name:')).toBeInTheDocument();
  });

  it('collapses metadata on a second click', async () => {
    const user = userEvent.setup();
    renderEventEntry();

    await user.click(screen.getAllByText('Scaled up replica set to 3')[0]);
    expect(screen.getByText('Event Message')).toBeInTheDocument();

    await user.click(screen.getAllByText('Scaled up replica set to 3')[0]);
    expect(screen.queryByText('Event Message')).not.toBeInTheDocument();
  });

  it('falls back to prop values when metadata is missing', async () => {
    const user = userEvent.setup();
    renderEventEntry({
      event: { ...sampleEvent, metadata: undefined },
      environmentName: 'staging',
      projectName: 'fallback-project',
      componentName: 'fallback-component',
    });

    await user.click(screen.getByText('Scaled up replica set to 3'));

    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('fallback-project')).toBeInTheDocument();
    expect(screen.getByText('fallback-component')).toBeInTheDocument();
  });
});
