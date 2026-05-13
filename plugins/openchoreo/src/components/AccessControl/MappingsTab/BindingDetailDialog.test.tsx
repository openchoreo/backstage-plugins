import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BindingDetail,
  BindingDetailDialog,
} from './BindingDetailDialog';

// ---- Fixtures ----

function makeBinding(overrides: Partial<BindingDetail> = {}): BindingDetail {
  return {
    name: 'admin-binding',
    entitlement: { claim: 'sub', value: 'platform-team' },
    effect: 'allow',
    roleMappings: [
      {
        role: 'admin',
        scope: 'cluster:*',
      },
    ],
    ...overrides,
  };
}

// ---- Tests ----

describe('BindingDetailDialog', () => {
  it('renders nothing when no binding is provided', () => {
    const { container } = render(
      <BindingDetailDialog
        open
        binding={null}
        onClose={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render when closed', () => {
    render(
      <BindingDetailDialog
        open={false}
        binding={makeBinding()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByText('admin-binding')).not.toBeInTheDocument();
  });

  it('renders the binding name, subject, and effect', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getAllByText('admin-binding').length).toBeGreaterThan(0);
    expect(screen.getByText(/sub = "platform-team"/)).toBeInTheDocument();
    expect(screen.getByText('ALLOW')).toBeInTheDocument();
  });

  it('renders DENY chip for deny effect', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding({ effect: 'deny' })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('DENY')).toBeInTheDocument();
  });

  it('renders the role mappings table', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding({
          roleMappings: [
            { role: 'admin', scope: 'cluster:*' },
            { role: 'viewer', scope: 'ns:default/*' },
          ],
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Role Mappings (2)')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('cluster:*')).toBeInTheDocument();
    expect(screen.getByText('viewer')).toBeInTheDocument();
    expect(screen.getByText('ns:default/*')).toBeInTheDocument();
  });

  it('renders the Cluster chip for cluster roles', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding({
          roleMappings: [
            { role: 'admin', scope: 'ns:team-a/*', isClusterRole: true },
          ],
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Cluster')).toBeInTheDocument();
  });

  it('renders conditions when a mapping has them', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding({
          roleMappings: [
            {
              role: 'admin',
              scope: 'cluster:*',
              conditions: [
                {
                  actions: ['releases:create'],
                  expression: 'resource.environment == "prod"',
                },
              ],
            },
          ],
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Conditions (1)')).toBeInTheDocument();
    expect(screen.getByText('releases:create')).toBeInTheDocument();
    expect(
      screen.getByText('resource.environment == "prod"'),
    ).toBeInTheDocument();
  });

  it('renders the System chip when the binding has the system label', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding({
          labels: { 'openchoreo.io/system': 'true' },
        })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('omits the System chip when the label is missing', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('calls onClose when the Close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <BindingDetailDialog
        open
        binding={makeBinding()}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders the Edit button only when onEdit is provided', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();

    render(
      <BindingDetailDialog
        open
        binding={makeBinding()}
        onClose={jest.fn()}
        onEdit={onEdit}
      />,
    );

    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);

    expect(onEdit).toHaveBeenCalled();
  });

  it('hides the Edit button when no onEdit handler is provided', () => {
    render(
      <BindingDetailDialog
        open
        binding={makeBinding()}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /edit/i }),
    ).not.toBeInTheDocument();
  });
});
