import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alertApiRef } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { createQueryWrapper } from '@openchoreo/test-utils';
import type {
  ComponentRelease,
  ReleaseBindingRevision,
  RollbackResponse,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  RevisionHistoryProvider,
  RevisionInfoRow,
  RollbackAction,
} from './RevisionHistorySection';
import type { Environment } from '../hooks';

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'frontend', namespace: 'default' },
};
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

const mockRefetchEnvironments = jest.fn();
const mockRefetchAutoDeploy = jest.fn();
// The component's auto deploy setting, as the Set up pane shares it.
const mockAutoDeploy = { value: true };
const mockSetAutoDeployOptimistic = jest.fn((next: boolean) => {
  mockAutoDeploy.value = next;
});
jest.mock('../EnvironmentsContext', () => ({
  useEnvironmentsContext: () => ({
    refetch: mockRefetchEnvironments,
    autoDeploy: mockAutoDeploy.value,
    autoDeployLoading: false,
    setAutoDeployOptimistic: mockSetAutoDeployOptimistic,
    refetchAutoDeploy: mockRefetchAutoDeploy,
  }),
}));

const mockPermission = {
  canRollback: true,
  loading: false,
  deniedTooltip: '',
};
const mockDeletePermission = {
  canDeleteRevision: true,
  loading: false,
  deniedTooltip: '',
};
const mockUpdatePermission = {
  canUpdate: true,
  loading: false,
  deniedTooltip: '',
};
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useReleaseBindingRollbackPermission: () => mockPermission,
  useReleaseBindingDeleteRevisionPermission: () => mockDeletePermission,
  useReleaseBindingUpdatePermission: () => mockUpdatePermission,
  YamlDiffViewer: () => <div data-testid="yaml-diff-viewer" />,
}));

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3600 * 1000).toISOString();

const makeRevision = (
  n: number,
  opts: {
    health?: string;
    active?: boolean;
    knownGood?: boolean;
    cause?: string;
    release?: string;
    hours?: number;
    message?: string;
    /** The revision active before this one. */
    previous?: number;
  } = {},
): ReleaseBindingRevision =>
  ({
    metadata: {
      name: `frontend-development-r${n}`,
      creationTimestamp: hoursAgo(opts.hours ?? 10 - n),
      ...(opts.previous
        ? {
            annotations: {
              'openchoreo.dev/previous-revision': String(opts.previous),
            },
          }
        : {}),
    },
    spec: {
      revision: n,
      cause: opts.cause ?? 'Deploy',
      bindingSpec: {
        owner: { projectName: 'shop', componentName: 'frontend' },
        releaseName: opts.release ?? `frontend-v${n}`,
      },
      ...(opts.message ? { message: opts.message } : {}),
    },
    status: {
      health: opts.health ?? 'Healthy',
      active: opts.active ?? false,
      knownGood: opts.knownGood ?? false,
    },
  } as unknown as ReleaseBindingRevision);

const release = (name: string) =>
  ({ metadata: { name } } as unknown as ComponentRelease);

const environment: Environment = {
  name: 'Development',
  resourceName: 'development',
  bindingName: 'frontend-development',
  deployment: { status: 'Ready', releaseName: 'frontend-v4' },
  endpoints: [],
};

// History before the rollback: r4 active, r3 degraded, r2 known good, and
// r1 whose release was deleted.
const history = () => [
  makeRevision(2, { knownGood: true, cause: 'Promote' }),
  makeRevision(4, { active: true, knownGood: true, cause: 'Override' }),
  makeRevision(1, { knownGood: true }),
  makeRevision(3, { health: 'Degraded' }),
];
const releases = ['frontend-v2', 'frontend-v3', 'frontend-v4'].map(release);

const preview: RollbackResponse = {
  revisionName: 'frontend-development-r2',
  revisionDisplayName: 'frontend-r2',
  revision: 2,
  targetRevision: 2,
  revertedFrom: 4,
  dryRun: true,
  changes: [
    { field: 'releaseName', current: 'frontend-v4', target: 'frontend-v2' },
  ],
  warnings: [
    {
      code: 'TargetNotKnownGood',
      message: 'revision 2 never stayed Healthy for the known-good window',
    },
  ],
};

const apiError = (status: number, error: Record<string, unknown>) =>
  ResponseError.fromResponse(
    new Response(JSON.stringify({ error, response: { statusCode: status } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

// The Revision Browser reads the binding's history limit when it opens;
// tests that are not about the limit get one that is not set anywhere.
const historyLimitClient = () => ({
  getBindingRevisionHistoryLimit: jest
    .fn()
    .mockResolvedValue({ bindingLimit: null, environmentLimit: null }),
});

// The pieces as the deploy panel places them: the revision row in the
// release section, Roll back in the Actions section.
function setup(
  client: Record<string, jest.Mock>,
  opts: { releasesKnown?: boolean; env?: Environment } = {},
) {
  const alertApi = { post: jest.fn(), alert$: jest.fn() };
  const wrapper = createQueryWrapper([
    [openChoreoClientApiRef, { ...historyLimitClient(), ...client }],
    [alertApiRef, alertApi],
  ]);
  render(
    <RevisionHistoryProvider
      environment={opts.env ?? environment}
      releases={releases}
      releasesKnown={opts.releasesKnown ?? true}
    >
      <RevisionInfoRow />
      <RollbackAction />
    </RevisionHistoryProvider>,
    { wrapper },
  );
  return { alertApi };
}

type User = ReturnType<typeof userEvent.setup>;

// The sidebar's Roll back action, in the Actions section.
const rollbackAction = () =>
  screen.getByRole('button', { name: /^Roll back$/ });

// Waits for the revision row to show the active revision's name.
const expectActiveRevision = async (name: string) => {
  await waitFor(() =>
    expect(screen.getByTestId('active-revision-name')).toHaveTextContent(name),
  );
};

// Opens the Revision Browser from Roll back once the revisions are loaded.
const openBrowser = async (user: User) => {
  await waitFor(() => expect(rollbackAction()).toBeEnabled());
  await user.click(rollbackAction());
  return screen.findByRole('dialog', { name: /Select revision/ });
};

// Opens the Revision Browser from Roll back and highlights revision n.
const browseTo = async (user: User, n: number) => {
  await openBrowser(user);
  await user.click(await screen.findByTestId(`browser-revision-${n}`));
};

// Picks revision n in the browser and opens its rollback confirmation.
const rollBackTo = async (user: User, n: number) => {
  await browseTo(user, n);
  await user.click(screen.getByRole('button', { name: `Roll back to r${n}` }));
  return screen.findByRole('dialog', { name: /^Roll back Development to/ });
};

// Each test drives MUI dialogs end to end, which is slow under a parallel
// run; the default 5s leaves no headroom.
jest.setTimeout(15000);

describe('RevisionHistorySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission.canRollback = true;
    mockPermission.deniedTooltip = '';
    mockDeletePermission.canDeleteRevision = true;
    mockDeletePermission.deniedTooltip = '';
    mockAutoDeploy.value = true;
  });

  it('shows the active revision beside the release, like the release name', async () => {
    // user-event stubs the clipboard; read back what was copied from it.
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
    });

    await expectActiveRevision('frontend-r4');
    const row = screen.getByTestId('revision-info-row');
    expect(within(row).getByText('Revision')).toBeInTheDocument();
    // Only the active revision shows; no picker or list.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);

    await user.click(within(row).getByLabelText('Copy revision name'));
    expect(await navigator.clipboard.readText()).toBe('frontend-r4');
  });

  it("views the active revision's manifest, like the release's", async () => {
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
    });

    await expectActiveRevision('frontend-r4');
    await user.click(screen.getByLabelText('View revision'));
    const manifest = await screen.findByRole('dialog', {
      name: 'Revision manifest — Development',
    });
    // Only the active revision: its full object, and no other revision.
    expect(manifest).toHaveTextContent('name: frontend-development-r4');
    expect(manifest).toHaveTextContent('kind: ReleaseBindingRevision');
    expect(manifest).not.toHaveTextContent('frontend-development-r2');

    await user.click(within(manifest).getByRole('button', { name: 'Copy' }));
    expect(await navigator.clipboard.readText()).toContain(
      'name: frontend-development-r4',
    );

    await user.click(within(manifest).getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('opens the Revision Browser on the active revision from its manifest', async () => {
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
    });

    await expectActiveRevision('frontend-r4');
    await user.click(screen.getByLabelText('View revision'));
    const manifest = await screen.findByRole('dialog', {
      name: 'Revision manifest — Development',
    });
    await user.click(
      within(manifest).getByRole('button', { name: 'Open Revision Browser' }),
    );
    const browser = await screen.findByRole('dialog', {
      name: /Select revision/,
    });
    expect(screen.getByTestId('browser-revision-4')).toHaveClass(
      'Mui-selected',
    );
    // r4 is active, so the browser offers no rollback to it.
    expect(
      within(browser).getByRole('button', { name: 'Roll back to r4' }),
    ).toBeDisabled();
  });

  it('opens the browser on the revision deployed now, not the undo target', async () => {
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue([
          makeRevision(2, { knownGood: true }),
          makeRevision(4, { active: true, previous: 2 }),
          makeRevision(3),
        ]),
    });

    await openBrowser(user);
    expect(screen.getByTestId('browser-revision-4')).toHaveClass(
      'Mui-selected',
    );
    expect(screen.getByTestId('browser-revision-2')).not.toHaveClass(
      'Mui-selected',
    );
  });

  it('disables rollback to a revision whose release is gone, with a tooltip', async () => {
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
    });

    await browseTo(user, 1);
    const button = screen.getByRole('button', { name: 'Roll back to r1' });
    expect(button).toBeDisabled();
    await user.hover(button.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Release frontend-v1 has been deleted, so frontend-r1 can no longer be restored.',
    );
  });

  it('disables Roll back without the rollback permission', async () => {
    mockPermission.canRollback = false;
    mockPermission.deniedTooltip =
      'You do not have permission to roll back the deployment in development';
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
    });

    await expectActiveRevision('frontend-r4');
    expect(rollbackAction()).toBeDisabled();
    await user.hover(rollbackAction().parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'You do not have permission to roll back the deployment in development',
    );
    // Viewing the history needs no rollback permission.
    expect(screen.getByLabelText('View revision')).toBeEnabled();
  });

  it('disables Roll back when no earlier revision exists', async () => {
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue([makeRevision(1, { active: true })]),
    });

    await expectActiveRevision('frontend-r1');
    expect(rollbackAction()).toBeDisabled();
    await user.hover(rollbackAction().parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'There is no earlier revision to roll back to.',
    );
  });

  it('dry-runs, confirms, toasts and shows the target active again', async () => {
    const user = userEvent.setup();
    let applied = false;
    // No revision is created: r2 becomes active again, restarting at
    // Progressing, and r4 stops being active.
    const after = () =>
      history().map(r => {
        if (r.spec.revision === 2) {
          return {
            ...r,
            status: { ...r.status, active: true, health: 'Progressing' },
          } as typeof r;
        }
        if (r.spec.revision === 4) {
          return { ...r, status: { ...r.status, active: false } } as typeof r;
        }
        return r;
      });
    const listReleaseBindingRevisions = jest.fn(async () =>
      applied ? after() : history(),
    );
    const rollbackReleaseBinding = jest.fn(
      async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => {
        if (!dryRun) applied = true;
        return { ...preview, dryRun };
      },
    );
    const { alertApi } = setup({
      listReleaseBindingRevisions,
      rollbackReleaseBinding,
    });

    const dialog = await rollBackTo(user, 2);

    // The dialog previews with a dry run and shows its warnings.
    expect(
      await within(dialog).findByText(
        /No revision is created: frontend-r2 becomes active again\./,
      ),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByTestId('rollback-warnings'),
    ).toHaveTextContent(
      'TargetNotKnownGood: revision 2 never stayed Healthy for the known-good window',
    );
    expect(within(dialog).getByTestId('rollback-changes')).toHaveTextContent(
      'releaseName"frontend-v4" → "frontend-v2"',
    );
    expect(rollbackReleaseBinding).toHaveBeenCalledTimes(1);
    expect(rollbackReleaseBinding).toHaveBeenLastCalledWith(
      entity,
      'frontend-development',
      2,
      true,
    );

    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    await waitFor(() =>
      expect(rollbackReleaseBinding).toHaveBeenLastCalledWith(
        entity,
        'frontend-development',
        2,
        false,
      ),
    );
    expect(alertApi.post).toHaveBeenCalledWith({
      message:
        'Rolled back Development to revision 2: frontend-r2 is active again.',
      severity: 'success',
      display: 'transient',
    });
    expect(mockRefetchEnvironments).toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // Without a reload, the row shows r2 as the active revision, and the
    // browser marks r2 Active and no longer r4; no revision is added.
    await expectActiveRevision('frontend-r2');
    await user.click(screen.getByLabelText('View revision'));
    await user.click(
      await screen.findByRole('button', { name: 'Open Revision Browser' }),
    );
    const browser = await screen.findByRole('dialog', {
      name: /Select revision/,
    });
    expect(within(browser).getByText('Showing 4 of 4')).toBeInTheDocument();
    expect(screen.getByTestId('browser-revision-2')).toHaveClass(
      'Mui-selected',
    );
    expect(
      within(browser).getByRole('button', { name: 'Roll back to r2' }),
    ).toBeDisabled();
  });

  it('shows a clear message when the rollback is forbidden', async () => {
    const user = userEvent.setup();
    const forbidden = await apiError(403, {
      name: 'NotAllowedError',
      message: 'forbidden',
    });
    const rollbackReleaseBinding = jest.fn(
      async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => {
        if (dryRun) return preview;
        throw forbidden;
      },
    );
    const { alertApi } = setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
    });

    const dialog = await rollBackTo(user, 2);
    await within(dialog).findByTestId('rollback-warnings');
    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    expect(
      await within(dialog).findByTestId('rollback-apply-error'),
    ).toHaveTextContent(
      'You do not have permission to roll back this deployment. Contact your administrator.',
    );
    expect(alertApi.post).not.toHaveBeenCalled();
  });

  it('explains a deleted release reported by the preview and blocks confirm', async () => {
    const user = userEvent.setup();
    const deleted = await apiError(409, {
      name: 'ConflictError',
      message: 'ComponentRelease frontend-v2 has been deleted',
      code: 'RELEASE_DELETED',
    });
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding: jest.fn().mockRejectedValue(deleted),
    });

    const dialog = await rollBackTo(user, 2);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The release this revision deployed has been deleted, so it can no longer be restored. ComponentRelease frontend-v2 has been deleted',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Roll back' }),
    ).toBeDisabled();
  });

  it('re-runs the preview after a concurrent change', async () => {
    const user = userEvent.setup();
    const concurrent = await apiError(409, {
      name: 'ConflictError',
      message: 'binding changed',
      code: 'CONCURRENT_MODIFICATION',
    });
    const rollbackReleaseBinding = jest
      .fn()
      .mockResolvedValueOnce(preview) // the preview
      .mockResolvedValueOnce(preview) // the check at Confirm
      .mockRejectedValueOnce(concurrent)
      .mockResolvedValueOnce(preview);
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
    });

    const dialog = await rollBackTo(user, 2);
    await within(dialog).findByTestId('rollback-warnings');
    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    expect(
      await within(dialog).findByTestId('rollback-apply-error'),
    ).toHaveTextContent(
      'The deployment changed while you were reviewing the rollback.',
    );
    await waitFor(() =>
      expect(rollbackReleaseBinding).toHaveBeenCalledTimes(4),
    );
    expect(rollbackReleaseBinding.mock.calls.map(c => c[3])).toEqual([
      true,
      true,
      false,
      true,
    ]);
  });

  it('shows an empty state with no revisions', async () => {
    setup({ listReleaseBindingRevisions: jest.fn().mockResolvedValue([]) });
    expect(
      await screen.findByText('No revisions recorded yet.'),
    ).toBeInTheDocument();
    expect(rollbackAction()).toBeDisabled();
  });

  it('says so when the revisions fail to load, and disables Roll back', async () => {
    setup({
      listReleaseBindingRevisions: jest
        .fn()
        .mockRejectedValue(new Error('backend down')),
    });
    expect(
      await screen.findByText('Could not load revisions'),
    ).toBeInTheDocument();
    expect(rollbackAction()).toBeDisabled();
  });

  it('renders nothing for an environment without a binding', () => {
    const listReleaseBindingRevisions = jest.fn();
    setup(
      { listReleaseBindingRevisions },
      { env: { ...environment, bindingName: undefined } },
    );
    expect(screen.queryByTestId('revision-info-row')).toBeNull();
    expect(screen.queryByRole('button', { name: /Roll back/ })).toBeNull();
    expect(listReleaseBindingRevisions).not.toHaveBeenCalled();
  });

  it('deletes an inactive revision after a server check, toasts and refreshes', async () => {
    const user = userEvent.setup();
    const listReleaseBindingRevisions = jest
      .fn()
      .mockResolvedValueOnce(history())
      .mockResolvedValue(history().filter(r => r.spec.revision !== 3));
    const deleteReleaseBindingRevision = jest
      .fn()
      .mockImplementation((_e, _b, revisionName: string, dryRun: boolean) =>
        Promise.resolve({
          revisionName,
          revisionDisplayName: 'frontend-r3',
          revision: 3,
          binding: 'frontend-development',
          environment: 'development',
          dryRun,
        }),
      );
    const { alertApi } = setup({
      listReleaseBindingRevisions,
      deleteReleaseBindingRevision,
    });

    await browseTo(user, 3);
    await user.click(screen.getByRole('button', { name: 'Delete r3' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete revision frontend-r3?',
    });
    const details = within(dialog).getByTestId('delete-revision-details');
    expect(details).toHaveTextContent('frontend-r3 (revision 3)');
    expect(details).toHaveTextContent('frontend-development');
    expect(details).toHaveTextContent('Development');
    expect(details).toHaveTextContent('Inactive · Degraded');
    expect(dialog).toHaveTextContent('removes it from the rollback history');
    const confirm = within(dialog).getByRole('button', {
      name: 'Delete revision',
    });
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(deleteReleaseBindingRevision).toHaveBeenCalledWith(
      entity,
      'frontend-development',
      'frontend-development-r3',
      true,
    );

    await user.click(confirm);
    await waitFor(() =>
      expect(deleteReleaseBindingRevision).toHaveBeenLastCalledWith(
        entity,
        'frontend-development',
        'frontend-development-r3',
        false,
      ),
    );
    expect(alertApi.post).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Deleted revision 3 (frontend-r3) from Development's history.",
        severity: 'success',
      }),
    );
    await waitFor(() =>
      expect(listReleaseBindingRevisions).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );

    // r3 is gone from the browser; the others keep their numbers.
    await openBrowser(user);
    await waitFor(() =>
      expect(screen.queryByTestId('browser-revision-3')).toBeNull(),
    );
    for (const n of [4, 2, 1]) {
      expect(screen.getByTestId(`browser-revision-${n}`)).toBeInTheDocument();
    }
  });

  it('cannot delete the active revision', async () => {
    const user = userEvent.setup();
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      deleteReleaseBindingRevision: jest.fn(),
    });

    await browseTo(user, 4);
    expect(screen.getByRole('button', { name: 'Delete r4' })).toBeDisabled();
  });

  it('keeps Delete disabled without the delete permission', async () => {
    const user = userEvent.setup();
    mockDeletePermission.canDeleteRevision = false;
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      deleteReleaseBindingRevision: jest.fn(),
    });

    await browseTo(user, 3);
    expect(screen.getByRole('button', { name: 'Delete r3' })).toBeDisabled();
  });

  it('shows the server refusal and offers no delete', async () => {
    const user = userEvent.setup();
    const deleteReleaseBindingRevision = jest.fn().mockRejectedValue(
      await apiError(409, {
        message: 'Cannot delete revision 3 because it is currently active',
        code: 'REVISION_PROTECTED',
      }),
    );
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      deleteReleaseBindingRevision,
    });

    await browseTo(user, 3);
    await user.click(screen.getByRole('button', { name: 'Delete r3' }));

    expect(await screen.findByTestId('delete-refused')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete revision' }),
    ).toBeDisabled();
    expect(deleteReleaseBindingRevision).toHaveBeenCalledTimes(1);
  });

  it('explains a rollback to a revision deleted meanwhile and refreshes the list', async () => {
    const user = userEvent.setup();
    const listReleaseBindingRevisions = jest
      .fn()
      .mockResolvedValueOnce(history())
      .mockResolvedValue(history().filter(r => r.spec.revision !== 2));
    setup({
      listReleaseBindingRevisions,
      rollbackReleaseBinding: jest.fn().mockRejectedValue(
        await apiError(404, {
          message: 'revision not found',
          code: 'NOT_FOUND',
        }),
      ),
    });

    const dialog = await rollBackTo(user, 2);

    expect(
      await within(dialog).findByText(
        'This revision no longer exists: it has been deleted, so it can no longer be rolled back to.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Roll back' }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(listReleaseBindingRevisions).toHaveBeenCalledTimes(2),
    );
  });

  it('explains a rollback blocked by auto deploy and offers no rollback', async () => {
    const user = userEvent.setup();
    const blocked = await apiError(409, {
      message:
        'Rollback blocked: auto-deploy is enabled for component "frontend", and "development" is the first environment of its deployment pipeline',
      code: 'AUTO_DEPLOY_ENABLED',
    });
    const rollbackReleaseBinding = jest.fn().mockRejectedValue(blocked);
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
    });

    const dialog = await rollBackTo(user, 2);
    expect(
      await within(dialog).findByText(
        'Rollback blocked: auto deploy is enabled for this component, and this is the first environment of its deployment pipeline, so auto deploy would move it straight back to the latest release. Turn off auto deploy for the component in the Set Up tab, then roll back again.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Roll back' }),
    ).toBeDisabled();
    // The Set up pane's switch is offered in place, still on, and the
    // setting is read again so the switch cannot show a stale value.
    expect(
      within(dialog).getByRole('checkbox', { name: 'Auto Deploy' }),
    ).toBeChecked();
    expect(mockRefetchAutoDeploy).toHaveBeenCalled();
    // Only the preview ran; nothing was applied.
    expect(rollbackReleaseBinding).toHaveBeenCalledTimes(1);
    expect(rollbackReleaseBinding).toHaveBeenLastCalledWith(
      entity,
      'frontend-development',
      2,
      true,
    );
  });

  it('turns auto deploy off from the blocked rollback and unblocks it', async () => {
    const user = userEvent.setup();
    const blocked = await apiError(409, {
      message: 'Rollback blocked: auto-deploy is enabled',
      code: 'AUTO_DEPLOY_ENABLED',
    });
    // Blocked until auto deploy is off, as the API decides it.
    const rollbackReleaseBinding = jest.fn(
      async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => {
        if (mockAutoDeploy.value) throw blocked;
        return { ...preview, dryRun };
      },
    );
    const patchComponent = jest.fn().mockResolvedValue(undefined);
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
      patchComponent,
    });

    const dialog = await rollBackTo(user, 2);
    const toggle = await within(dialog).findByRole('checkbox', {
      name: 'Auto Deploy',
    });
    expect(toggle).toBeChecked();
    expect(
      within(dialog).getByRole('button', { name: 'Roll back' }),
    ).toBeDisabled();

    // Switching it off asks first, with the Set up pane's confirmation.
    await user.click(toggle);
    const confirm = await screen.findByRole('dialog', {
      name: 'Disable Auto Deploy?',
    });
    expect(patchComponent).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(patchComponent).toHaveBeenCalledWith(entity, false),
    );
    expect(mockSetAutoDeployOptimistic).toHaveBeenCalledWith(false);

    // The preview runs again and the rollback is now offered.
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Roll back' }),
      ).toBeEnabled(),
    );
    expect(within(dialog).queryByText(/Rollback blocked/)).toBeNull();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Auto Deploy' }),
    ).not.toBeChecked();
    // Two dry runs, nothing applied.
    expect(rollbackReleaseBinding).toHaveBeenCalledTimes(2);
    expect(rollbackReleaseBinding.mock.calls.every(c => c[3] === true)).toBe(
      true,
    );
  });

  it('keeps auto deploy on when turning it off is cancelled or fails', async () => {
    const user = userEvent.setup();
    const blocked = await apiError(409, {
      message: 'Rollback blocked: auto-deploy is enabled',
      code: 'AUTO_DEPLOY_ENABLED',
    });
    const rollbackReleaseBinding = jest.fn().mockRejectedValue(blocked);
    const patchComponent = jest.fn().mockRejectedValue(new Error('boom'));
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
      patchComponent,
    });

    const dialog = await rollBackTo(user, 2);
    const toggle = await within(dialog).findByRole('checkbox', {
      name: 'Auto Deploy',
    });

    // Cancelling the confirmation changes nothing.
    await user.click(toggle);
    let confirm = await screen.findByRole('dialog', {
      name: 'Disable Auto Deploy?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(patchComponent).not.toHaveBeenCalled();
    expect(toggle).toBeChecked();

    // A failed save snaps the switch back and says why.
    await user.click(toggle);
    confirm = await screen.findByRole('dialog', {
      name: 'Disable Auto Deploy?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Confirm' }));
    expect(
      await within(dialog).findByTestId('rollback-auto-deploy-error'),
    ).toHaveTextContent('Failed to update auto deploy setting: boom');
    expect(mockAutoDeploy.value).toBe(true);
    // Found once the confirmation has closed and the dialog is exposed again.
    expect(
      await within(dialog).findByRole('checkbox', { name: 'Auto Deploy' }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole('button', { name: 'Roll back' }),
    ).toBeDisabled();
    // The rollback was only ever previewed, once.
    expect(rollbackReleaseBinding).toHaveBeenCalledTimes(1);
  });

  it('sends the optional reason with the confirmed rollback only', async () => {
    const user = userEvent.setup();
    const rollbackReleaseBinding = jest.fn(
      async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => ({
        ...preview,
        dryRun,
      }),
    );
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
    });

    const dialog = await rollBackTo(user, 2);
    const reason = await within(dialog).findByRole('textbox', {
      name: 'Reason (optional)',
    });
    await user.type(reason, '  Payments failing since r4  ');
    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    // The preview and the check at Confirm send no reason; the apply does.
    await waitFor(() =>
      expect(rollbackReleaseBinding).toHaveBeenCalledTimes(3),
    );
    for (const call of [1, 2]) {
      expect(rollbackReleaseBinding).toHaveBeenNthCalledWith(
        call,
        entity,
        'frontend-development',
        2,
        true,
      );
    }
    expect(rollbackReleaseBinding).toHaveBeenNthCalledWith(
      3,
      entity,
      'frontend-development',
      2,
      false,
      'Payments failing since r4',
    );
  });

  it('sends no reason when the field is left empty', async () => {
    const user = userEvent.setup();
    const rollbackReleaseBinding = jest.fn(
      async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => ({
        ...preview,
        dryRun,
      }),
    );
    setup({
      listReleaseBindingRevisions: jest.fn().mockResolvedValue(history()),
      rollbackReleaseBinding,
    });

    const dialog = await rollBackTo(user, 2);
    await within(dialog).findByTestId('rollback-changes');
    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));
    await waitFor(() =>
      expect(rollbackReleaseBinding).toHaveBeenLastCalledWith(
        entity,
        'frontend-development',
        2,
        false,
      ),
    );
  });
});
