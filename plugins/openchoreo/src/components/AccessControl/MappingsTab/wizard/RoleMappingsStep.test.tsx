import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClusterRole, UserTypeConfig } from '../../hooks';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';
import { RoleMappingsStep } from './RoleMappingsStep';
import { WizardRoleMapping, WizardState } from './types';

// ---- Mocks ----

jest.mock('./RoleMappingDialog', () => ({
  RoleMappingDialog: ({ open, initial, onSave, onCancel }: any) =>
    open ? (
      <div data-testid="role-mapping-dialog">
        <span data-testid="dialog-mode">{initial ? 'edit' : 'create'}</span>
        <button
          data-testid="dialog-save"
          onClick={() =>
            onSave({
              role: 'admin',
              roleNamespace: '',
              namespace: '',
              project: '',
              component: '',
              confirmed: true,
              conditions: [],
            })
          }
        >
          Save
        </button>
        <button data-testid="dialog-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// ---- Fixtures ----

const availableRoles: ClusterRole[] = [
  { name: 'admin', actions: ['read', 'write'] } as unknown as ClusterRole,
];

const userTypes: UserTypeConfig[] = [];

function makeMapping(
  overrides: Partial<WizardRoleMapping> = {},
): WizardRoleMapping {
  return {
    role: 'viewer',
    roleNamespace: '',
    namespace: '',
    project: '',
    component: '',
    confirmed: true,
    conditions: [],
    ...overrides,
  };
}

function baseState(
  roleMappings: WizardRoleMapping[] = [],
  overrides: Partial<WizardState> = {},
): WizardState {
  return {
    subjectType: 'user',
    entitlementValue: 'team-a',
    roleMappings,
    effect: 'allow',
    name: '',
    ...overrides,
  };
}

function renderStep(
  state: WizardState,
  onChange: (updates: Partial<WizardState>) => void,
  props: Partial<React.ComponentProps<typeof RoleMappingsStep>> = {},
) {
  return render(
    <RoleMappingsStep
      state={state}
      onChange={onChange}
      availableRoles={availableRoles}
      userTypes={userTypes}
      bindingType={SCOPE_CLUSTER}
      {...props}
    />,
  );
}

// ---- Tests ----

describe('RoleMappingsStep', () => {
  it('shows the empty state when there are no confirmed mappings', () => {
    renderStep(baseState(), jest.fn());

    expect(screen.getByText(/No role mappings yet/i)).toBeInTheDocument();
  });

  it('hides unconfirmed mappings from the table', () => {
    const state = baseState([
      makeMapping({ role: 'pending-role', confirmed: false }),
    ]);

    renderStep(state, jest.fn());

    expect(screen.queryByText('pending-role')).not.toBeInTheDocument();
    expect(screen.getByText(/No role mappings yet/i)).toBeInTheDocument();
  });

  it('renders a row per confirmed mapping with the scope path', () => {
    const state = baseState([
      makeMapping({ role: 'admin', namespace: 'default', project: 'core' }),
    ]);

    renderStep(state, jest.fn());

    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('ns:default/proj:core/*')).toBeInTheDocument();
  });

  it('shows a dash when a mapping has no conditions', () => {
    const state = baseState([makeMapping({ role: 'admin' })]);

    renderStep(state, jest.fn());

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the singular conditions chip label', () => {
    const state = baseState([
      makeMapping({
        conditions: [
          {
            id: 'c1',
            actions: ['read'],
            expression: 'true',
            confirmed: true,
          },
        ],
      }),
    ]);

    renderStep(state, jest.fn());

    expect(screen.getByText('1 condition')).toBeInTheDocument();
  });

  it('shows the pluralized conditions chip label', () => {
    const state = baseState([
      makeMapping({
        conditions: [
          { id: 'c1', actions: ['read'], expression: 'a', confirmed: true },
          { id: 'c2', actions: ['write'], expression: 'b', confirmed: true },
        ],
      }),
    ]);

    renderStep(state, jest.fn());

    expect(screen.getByText('2 conditions')).toBeInTheDocument();
  });

  it('shows the Cluster chip on namespace bindings using a cluster role', () => {
    const state = baseState([
      makeMapping({ role: 'admin', roleNamespace: '' }),
    ]);

    renderStep(state, jest.fn(), {
      bindingType: SCOPE_NAMESPACE,
      namespace: 'team-a',
    });

    expect(screen.getByText('Cluster')).toBeInTheDocument();
  });

  it('does not show the Cluster chip when the role is namespace-scoped', () => {
    const state = baseState([
      makeMapping({ role: 'admin', roleNamespace: 'team-a' }),
    ]);

    renderStep(state, jest.fn(), {
      bindingType: SCOPE_NAMESPACE,
      namespace: 'team-a',
    });

    expect(screen.queryByText('Cluster')).not.toBeInTheDocument();
  });

  it('opens the dialog in create mode when Add Mapping is clicked', async () => {
    const user = userEvent.setup();

    renderStep(baseState(), jest.fn());

    await user.click(screen.getByRole('button', { name: /add mapping/i }));

    expect(screen.getByTestId('role-mapping-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-mode')).toHaveTextContent('create');
  });

  it('opens the dialog in edit mode when Edit is clicked on a row', async () => {
    const user = userEvent.setup();

    const state = baseState([makeMapping({ role: 'admin' })]);

    renderStep(state, jest.fn());

    await user.click(screen.getByTitle('Edit'));

    expect(screen.getByTestId('role-mapping-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-mode')).toHaveTextContent('edit');
  });

  it('appends a new mapping when the dialog saves in create mode', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderStep(baseState(), onChange);

    await user.click(screen.getByRole('button', { name: /add mapping/i }));
    await user.click(screen.getByTestId('dialog-save'));

    expect(onChange).toHaveBeenCalledWith({
      roleMappings: [expect.objectContaining({ role: 'admin' })],
    });
  });

  it('replaces the edited mapping when the dialog saves in edit mode', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    const state = baseState([makeMapping({ role: 'viewer' })]);
    renderStep(state, onChange);

    await user.click(screen.getByTitle('Edit'));
    await user.click(screen.getByTestId('dialog-save'));

    expect(onChange).toHaveBeenCalledWith({
      roleMappings: [expect.objectContaining({ role: 'admin' })],
    });
  });

  it('removes a mapping when Delete is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    const state = baseState([
      makeMapping({ role: 'viewer' }),
      makeMapping({ role: 'admin' }),
    ]);

    renderStep(state, onChange);

    await user.click(screen.getAllByTitle('Delete')[0]);

    expect(onChange).toHaveBeenCalledWith({
      roleMappings: [expect.objectContaining({ role: 'admin' })],
    });
  });

  it('closes the dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();

    renderStep(baseState(), jest.fn());

    await user.click(screen.getByRole('button', { name: /add mapping/i }));
    expect(screen.getByTestId('role-mapping-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('dialog-cancel'));

    expect(
      screen.queryByTestId('role-mapping-dialog'),
    ).not.toBeInTheDocument();
  });
});
