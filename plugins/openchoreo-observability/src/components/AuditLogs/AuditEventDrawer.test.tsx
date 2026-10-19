import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditEventDrawer } from './AuditEventDrawer';
import { AuditLogRecord } from './types';

jest.mock('@openchoreo/backstage-design-system', () => ({
  JsonViewer: () => <div data-testid="json-viewer" />,
}));

const record: AuditLogRecord = {
  schema_version: '1.0',
  event_id: 'e-1',
  event_time: '2026-09-03T10:00:00.000Z',
  actor: { type: 'user', id: 'dilani@openchoreo.dev' },
  action: 'create_project',
  category: 'management',
  result: 'denied',
};

const defaults = {
  record,
  open: true,
  onClose: jest.fn(),
  onAddToken: jest.fn(),
};

describe('AuditEventDrawer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds a filter for the attribute that was clicked', async () => {
    const onAddToken = jest.fn();
    render(<AuditEventDrawer {...defaults} onAddToken={onAddToken} />);

    await userEvent.click(
      screen.getByTitle('Filter by actor.id:dilani@openchoreo.dev'),
    );

    expect(onAddToken).toHaveBeenCalledWith(
      'actor.id',
      'dilani@openchoreo.dev',
    );
  });

  it('closes on a drill, so the narrowed list is what the reader lands on', async () => {
    const onClose = jest.fn();
    const onAddToken = jest.fn();
    render(
      <AuditEventDrawer
        {...defaults}
        onClose={onClose}
        onAddToken={onAddToken}
      />,
    );

    await userEvent.click(screen.getByTitle('Filter by category:management'));

    expect(onAddToken).toHaveBeenCalledWith('category', 'management');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on the close button, which is what asks for it', async () => {
    const onClose = jest.fn();
    render(<AuditEventDrawer {...defaults} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('filters the resource level by resource.resource, not by the name', async () => {
    const onAddToken = jest.fn();
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          resource: {
            type: 'resourcereleasebinding',
            namespace: 'default',
            project: 'shop',
            resource: 'orders-db',
            name: 'orders-db-production',
          },
        }}
        onAddToken={onAddToken}
      />,
    );

    await userEvent.click(
      screen.getByTitle('Filter by resource.resource:orders-db'),
    );
    expect(onAddToken).toHaveBeenCalledWith('resource.resource', 'orders-db');
  });

  it('shows the release line and filters by it', async () => {
    const onAddToken = jest.fn();
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          resource: {
            type: 'workload',
            namespace: 'default',
            project: 'default',
            component: 'hello',
            release_line: 'next',
            name: 'hello-next-workload',
          },
        }}
        onAddToken={onAddToken}
      />,
    );

    await userEvent.click(
      screen.getByTitle('Filter by resource.release_line:next'),
    );
    expect(onAddToken).toHaveBeenCalledWith('resource.release_line', 'next');
  });

  it('leaves the cluster scope as text, since no filter selects it', () => {
    render(
      <AuditEventDrawer
        {...defaults}
        record={{ ...record, resource: { type: 'clustercomponenttype' } }}
      />,
    );

    expect(screen.getByText('cluster').closest('button')).toBeNull();
  });

  it('says why a value is missing rather than leaving it blank', () => {
    render(<AuditEventDrawer {...defaults} />);

    expect(screen.getByText('No validated token.')).toBeInTheDocument();
  });

  it('shows what a 1.1 read was asked for and what it returned', () => {
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          schema_version: '1.1',
          action: 'list_secrets',
          category: 'access',
          result: 'success',
          request: {
            parameters: {
              podName: 'checkout-7f9c',
              sinceSeconds: 3600,
              actor: { id: ['alice'] },
              user_agent: ['Mozilla/5.0 (KHTML, like Gecko)', 'curl/8.4.0'],
            },
          },
          returned: {
            count: 3,
            items: [
              {
                type: 'secret',
                namespace: 'acme',
                name: 'db-creds',
                uid: 'uid-a',
              },
              { type: 'secret', name: 'api-key' },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByText('podName')).toBeInTheDocument();
    expect(screen.getByText('checkout-7f9c')).toBeInTheDocument();
    expect(screen.getByText('sinceSeconds')).toBeInTheDocument();
    expect(screen.getByText('3600')).toBeInTheDocument();
    expect(screen.getByText('actor.id')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(
      screen.getByText('Mozilla/5.0 (KHTML, like Gecko)'),
    ).toBeInTheDocument();
    expect(screen.getByText('curl/8.4.0')).toBeInTheDocument();

    expect(screen.getByText('Returned')).toBeInTheDocument();
    expect(screen.getByText('3 entries')).toBeInTheDocument();
    expect(
      screen.getByText('The list was cut: 2 of 3 identified.'),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('Filter by returned.items.name:db-creds'),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('Filter by returned.items.name:api-key'),
    ).toBeInTheDocument();
  });

  it('filters by a returned object’s name', async () => {
    const onAddToken = jest.fn();
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          schema_version: '1.1',
          result: 'success',
          returned: {
            count: 1,
            items: [{ type: 'secret', namespace: 'acme', name: 'db-creds' }],
          },
        }}
        onAddToken={onAddToken}
      />,
    );

    await userEvent.click(
      screen.getByTitle('Filter by returned.items.name:db-creds'),
    );
    expect(onAddToken).toHaveBeenCalledWith('returned.items.name', 'db-creds');
  });

  it('shows a count of zero rather than treating it as absent', () => {
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          schema_version: '1.1',
          result: 'success',
          returned: { count: 0 },
        }}
      />,
    );

    expect(screen.getByText('0 entries')).toBeInTheDocument();
    expect(
      screen.getByText('No object identities recorded.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The list was cut/)).not.toBeInTheDocument();
  });

  it('says so when a request carries no parameters', () => {
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          schema_version: '1.1',
          request: { parameters: {} },
        }}
      />,
    );

    expect(screen.getByText('No parameters recorded.')).toBeInTheDocument();
  });

  it('renders a 1.0 record with no parameters or returned row', () => {
    render(<AuditEventDrawer {...defaults} />);

    expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    expect(screen.queryByText('Returned')).not.toBeInTheDocument();
  });
});
