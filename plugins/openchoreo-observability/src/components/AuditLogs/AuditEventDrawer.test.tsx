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

  it('filters by a scope chip, and by name for the resource level', async () => {
    const onAddToken = jest.fn();
    render(
      <AuditEventDrawer
        {...defaults}
        record={{
          ...record,
          resource: {
            type: 'component',
            namespace: 'default',
            project: 'shop',
            component: 'cart',
            resource: 'cart',
            name: 'cart',
          },
        }}
        onAddToken={onAddToken}
      />,
    );

    await userEvent.click(screen.getByTitle('Filter by resource.project:shop'));
    expect(onAddToken).toHaveBeenCalledWith('resource.project', 'shop');

    const resourceChip = screen
      .getByText('resource', { selector: 'span' })
      .closest('button');
    expect(resourceChip).toHaveAttribute(
      'title',
      'Filter by resource.name:cart',
    );
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
});
