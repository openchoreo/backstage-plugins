import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RolesTable, type BindingSummary } from './RolesTable';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../constants';

// ---- Mocks ----

const mockUseActions = jest.fn();
jest.mock('../hooks', () => ({
  useActions: () => mockUseActions(),
}));

// ---- Helpers ----

const AVAILABLE_ACTIONS = [
  'component:view',
  'component:create',
  'component:update',
  'component:delete',
  'project:view',
  'project:create',
  'environment:view',
  'environment:create',
  'dataplane:view',
  'dataplane:create',
  'workflow:view',
  'workflow:create',
  'logs:view',
];

function actionInfos(names: string[]) {
  return names.map(name => ({ name }));
}

type Props = React.ComponentProps<typeof RolesTable>;

function renderTable(overrides: Partial<Props> = {}) {
  const onEdit = jest.fn();
  const onDelete = jest.fn().mockResolvedValue(undefined);
  const onCheckBindings = jest.fn().mockResolvedValue([] as BindingSummary[]);

  const props: Props = {
    roles: [{ name: 'admin', actions: ['logs:view'] }],
    scope: SCOPE_CLUSTER,
    scopeLabel: 'Cluster Role',
    canUpdate: true,
    canDelete: true,
    updateDeniedTooltip: '',
    deleteDeniedTooltip: '',
    onEdit,
    onDelete,
    onCheckBindings,
    ...overrides,
  };

  const utils = render(<RolesTable {...props} />);
  return { ...utils, props, onEdit, onDelete, onCheckBindings };
}

// ---- Tests ----

describe('RolesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseActions.mockReturnValue({
      actions: actionInfos(AVAILABLE_ACTIONS),
      loading: false,
    });
  });

  it('renders roles with their names and descriptions', () => {
    renderTable({
      roles: [
        { name: 'admin', actions: ['logs:view'], description: 'Full access' },
      ],
    });

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Full access')).toBeInTheDocument();
  });

  it('shows a System chip for system roles', () => {
    renderTable({
      roles: [
        {
          name: 'admin',
          actions: ['logs:view'],
          labels: { 'openchoreo.io/system': 'true' },
        },
      ],
    });

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders "No actions" when a role has no actions', () => {
    renderTable({ roles: [{ name: 'empty', actions: [] }] });

    expect(screen.getByText('No actions')).toBeInTheDocument();
  });

  it('collapses a fully-selected category into a wildcard label', () => {
    renderTable({
      roles: [
        {
          name: 'editor',
          actions: [
            'component:view',
            'component:create',
            'component:update',
            'component:delete',
          ],
        },
      ],
    });

    expect(screen.getByText('All component actions')).toBeInTheDocument();
  });

  it('shows a "+N more" chip when a role has more than five actions', () => {
    renderTable({
      roles: [
        {
          name: 'busy',
          actions: [
            'component:view',
            'project:view',
            'environment:view',
            'dataplane:view',
            'workflow:view',
            'logs:view',
          ],
        },
      ],
    });

    // 6 chips after normalization (logs collapses to logs:*) -> first 5 + "+1 more".
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('filters roles by search query on name', async () => {
    const user = userEvent.setup();
    renderTable({
      roles: [
        { name: 'admin', actions: ['logs:view'] },
        { name: 'viewer', actions: ['logs:view'] },
      ],
    });

    await user.type(
      screen.getByPlaceholderText(/search cluster roles/i),
      'viewer',
    );

    expect(screen.getByText('viewer')).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
  });

  it('shows an empty-search message when nothing matches', async () => {
    const user = userEvent.setup();
    renderTable({ roles: [{ name: 'admin', actions: ['logs:view'] }] });

    await user.type(
      screen.getByPlaceholderText(/search cluster roles/i),
      'zzz',
    );

    expect(
      screen.getByText('No cluster roles match your search'),
    ).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no roles', () => {
    renderTable({ roles: [] });

    expect(
      screen.getByText(/no cluster roles defined yet/i),
    ).toBeInTheDocument();
  });

  it('calls onEdit when the edit button is clicked', async () => {
    const user = userEvent.setup();
    const { onEdit, props } = renderTable();

    await user.click(screen.getByRole('button', { name: /edit role admin/i }));

    expect(onEdit).toHaveBeenCalledWith(props.roles[0]);
  });

  it('disables edit and delete buttons when permissions are denied', () => {
    renderTable({ canUpdate: false, canDelete: false });

    expect(
      screen.getByRole('button', { name: /edit role admin/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /delete role admin/i }),
    ).toBeDisabled();
  });

  it('shows a checking spinner while bindings are being looked up', async () => {
    const user = userEvent.setup();
    let resolveCheck: (value: BindingSummary[]) => void = () => {};
    const onCheckBindings = jest.fn().mockImplementation(
      () =>
        new Promise<BindingSummary[]>(resolve => {
          resolveCheck = resolve;
        }),
    );
    renderTable({ onCheckBindings });

    await user.click(
      screen.getByRole('button', { name: /delete role admin/i }),
    );

    expect(
      screen.getByText('Checking for role bindings...'),
    ).toBeInTheDocument();

    resolveCheck([]);
    await waitFor(() =>
      expect(
        screen.queryByText('Checking for role bindings...'),
      ).not.toBeInTheDocument(),
    );
  });

  it('confirms and calls onDelete when there are no active bindings', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderTable();

    await user.click(
      screen.getByRole('button', { name: /delete role admin/i }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/are you sure you want to delete/i),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('admin'));
  });

  it('cancels deletion without calling onDelete', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderTable();

    await user.click(
      screen.getByRole('button', { name: /delete role admin/i }),
    );

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('blocks deletion and lists active bindings (cluster scope)', async () => {
    const user = userEvent.setup();
    const onCheckBindings = jest.fn().mockResolvedValue([
      {
        name: 'binding-a',
        entitlement: { claim: 'group', value: 'devs' },
        effect: 'allow',
        type: SCOPE_CLUSTER,
      },
      {
        name: 'binding-b',
        entitlement: { claim: 'group', value: 'ops' },
        effect: 'allow',
        type: SCOPE_NAMESPACE,
        namespace: 'team-a',
      },
    ] as BindingSummary[]);
    const { onDelete } = renderTable({ onCheckBindings });

    await user.click(
      screen.getByRole('button', { name: /delete role admin/i }),
    );

    expect(
      await screen.findByText('Cannot Delete Cluster Role'),
    ).toBeInTheDocument();
    expect(screen.getByText('Binding: binding-a')).toBeInTheDocument();
    expect(screen.getByText('Type: Cluster')).toBeInTheDocument();
    expect(screen.getByText('Type: Namespace (team-a)')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('treats a binding-check failure as no active bindings', async () => {
    const user = userEvent.setup();
    const onCheckBindings = jest.fn().mockRejectedValue(new Error('boom'));
    renderTable({ onCheckBindings });

    await user.click(
      screen.getByRole('button', { name: /delete role admin/i }),
    );

    expect(
      await screen.findByText(/are you sure you want to delete/i),
    ).toBeInTheDocument();
  });
});
