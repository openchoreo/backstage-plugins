import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleDialog } from './RoleDialog';
import { SCOPE_CLUSTER } from '../constants';

// ---- Mocks ----

const mockUseActions = jest.fn();
jest.mock('../hooks', () => ({
  useActions: () => mockUseActions(),
}));

jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: (err: any) => err?.message?.includes('403'),
  getErrorMessage: (err: any) => err?.message ?? 'Unknown error',
}));

jest.mock('./ActionSelectionDialog', () => ({
  ActionSelectionDialog: ({ open, onConfirm }: any) =>
    open ? (
      <div data-testid="action-selection-dialog">
        <button
          data-testid="confirm-actions"
          onClick={() => onConfirm(['project:view'])}
        >
          Confirm
        </button>
      </div>
    ) : null,
}));

// ---- Helpers ----

const AVAILABLE_ACTIONS = [
  'component:view',
  'component:create',
  'component:update',
  'component:delete',
  'project:view',
  'project:create',
  'logs:view',
];

function actionInfos(names: string[]) {
  return names.map(name => ({ name }));
}

type Props = React.ComponentProps<typeof RoleDialog>;

function renderDialog(overrides: Partial<Props> = {}) {
  const onClose = jest.fn();
  const onSave = jest.fn().mockResolvedValue(undefined);

  const props: Props = {
    open: true,
    onClose,
    onSave,
    scope: SCOPE_CLUSTER,
    ...overrides,
  };

  const utils = render(<RoleDialog {...props} />);
  return { ...utils, onClose, onSave };
}

// ---- Tests ----

describe('RoleDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseActions.mockReturnValue({
      actions: actionInfos(AVAILABLE_ACTIONS),
      loading: false,
    });
  });

  it('normalizes an editing role\'s actions into wildcard chips on open', () => {
    renderDialog({
      editingRole: {
        name: 'editor',
        actions: [
          'component:view',
          'component:create',
          'component:update',
          'component:delete',
        ],
      },
    });

    // The four component actions collapse to a single wildcard chip, but the
    // count reflects the actual number of granular actions granted.
    expect(screen.getByText('All component actions')).toBeInTheDocument();
    expect(screen.getByText('Select Actions (4 selected)')).toBeInTheDocument();
  });

  it('applies a quick-start template and normalizes its actions', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Admin' }));

    // The admin template grants every action -> collapses to the global
    // wildcard chip, but the count reflects all granular actions it expands to.
    expect(screen.getByText('All Actions')).toBeInTheDocument();
    expect(
      screen.getByText(
        `Select Actions (${AVAILABLE_ACTIONS.length} selected)`,
      ),
    ).toBeInTheDocument();
  });

  it('validates that a role name is required', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Role name is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a valid role', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.type(screen.getByRole('textbox'), 'reader');
    await user.click(screen.getByRole('button', { name: /select actions/i }));
    await user.click(await screen.findByTestId('confirm-actions'));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: 'reader',
        actions: ['project:view'],
      }),
    );
  });

  it('shows a permission message when saving is forbidden', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockRejectedValue(new Error('403 Forbidden'));
    renderDialog({
      onSave,
      editingRole: { name: 'editor', actions: ['project:view'] },
    });

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(
      await screen.findByText(/do not have permission to save this role/i),
    ).toBeInTheDocument();
  });

  it('surfaces a generic error message when saving fails', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockRejectedValue(new Error('Server exploded'));
    renderDialog({
      onSave,
      editingRole: { name: 'editor', actions: ['project:view'] },
    });

    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });
});
