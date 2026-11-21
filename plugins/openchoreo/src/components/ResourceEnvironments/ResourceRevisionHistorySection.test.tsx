import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alertApiRef } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { createQueryWrapper } from '@openchoreo/test-utils';
import type {
  ResourceReleaseBindingRevision,
  RollbackResponse,
} from '@openchoreo/backstage-plugin-common';
import YAML from 'yaml';
import {
  openChoreoClientApiRef,
  type ResourceEnvironment,
} from '../../api/OpenChoreoClientApi';
import { ResourceRevisionHistorySection } from './ResourceRevisionHistorySection';

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Resource',
  metadata: { name: 'orders-db', namespace: 'default' },
};
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

const mockRefetch = jest.fn();
jest.mock('./ResourceEnvironmentsContext', () => ({
  useResourceEnvironmentsContext: () => ({ refetch: mockRefetch }),
}));

const mockPermission = {
  canRollback: true,
  loading: false,
  deniedTooltip: '',
};
const mockResourcePermissionEnv = jest.fn();
const mockComponentPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useResourceReleaseBindingRollbackPermission: (env: string) => {
    mockResourcePermissionEnv(env);
    return mockPermission;
  },
  useReleaseBindingRollbackPermission: (env: string) => {
    mockComponentPermission(env);
    return mockPermission;
  },
  useResourceReleaseBindingUpdatePermission: () => ({
    canUpdate: true,
    loading: false,
    deniedTooltip: '',
  }),
  useResourceReleaseBindingDeleteRevisionPermission: () => ({
    canDeleteRevision: true,
    loading: false,
    deniedTooltip: '',
  }),
  useReleaseBindingDeleteRevisionPermission: (env: string) => {
    mockComponentPermission(env);
    return { canDeleteRevision: true, loading: false, deniedTooltip: '' };
  },
  // CodeMirror's MergeView does not run under jsdom; render what it is given.
  YamlDiffViewer: (props: {
    original: string;
    modified: string;
    originalLabel?: string;
    modifiedLabel?: string;
  }) => (
    <div data-testid="yaml-diff-viewer">
      <div data-testid="diff-original-label">{props.originalLabel}</div>
      <div data-testid="diff-modified-label">{props.modifiedLabel}</div>
      <pre data-testid="diff-original">{props.original}</pre>
      <pre data-testid="diff-modified">{props.modified}</pre>
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  ...jest.requireActual('@openchoreo/backstage-design-system'),
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
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
    size?: string;
  } = {},
): ResourceReleaseBindingRevision =>
  ({
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ResourceReleaseBindingRevision',
    metadata: {
      name: `orders-db-development-r${n}`,
      creationTimestamp: hoursAgo(10 - n),
    },
    spec: {
      revision: n,
      cause: opts.cause ?? 'Deploy',
      resourceReleaseName: `orders-db-v${n}`,
      snapshotHash: `hash-${n}`,
      bindingSpec: {
        owner: { projectName: 'shop', resourceName: 'orders-db' },
        releaseName: `orders-db-v${n}`,
        resourceTypeEnvironmentConfigs: { size: opts.size ?? 'small' },
      },
    },
    status: {
      health: opts.health ?? 'Healthy',
      active: opts.active ?? false,
      knownGood: opts.knownGood ?? false,
    },
  } as unknown as ResourceReleaseBindingRevision);

const env: ResourceEnvironment = {
  name: 'Development',
  resourceName: 'development',
  bindingName: 'orders-db-development',
  resourceRelease: 'orders-db-v3',
  status: 'Ready',
} as ResourceEnvironment;

// r3 active with a larger size, r2 known good, r1 degraded.
const history = () => [
  makeRevision(1, { health: 'Degraded' }),
  makeRevision(3, {
    active: true,
    knownGood: true,
    cause: 'Override',
    size: 'large',
  }),
  makeRevision(2, { knownGood: true }),
];

const preview: RollbackResponse = {
  revisionName: 'orders-db-development-r2',
  revisionDisplayName: 'orders-db-r2',
  revision: 2,
  targetRevision: 2,
  revertedFrom: 3,
  dryRun: true,
  changes: [
    {
      field: 'resourceTypeEnvironmentConfigs',
      current: { size: 'large' },
      target: { size: 'small' },
    },
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

function setup(client: Record<string, jest.Mock>) {
  const alertApi = { post: jest.fn(), alert$: jest.fn() };
  const wrapper = createQueryWrapper([
    [
      openChoreoClientApiRef,
      {
        // The Revision Browser reads the history limit when it opens.
        getBindingRevisionHistoryLimit: jest
          .fn()
          .mockResolvedValue({ bindingLimit: null, environmentLimit: null }),
        ...client,
      },
    ],
    [alertApiRef, alertApi],
  ]);
  render(<ResourceRevisionHistorySection env={env} />, { wrapper });
  return { alertApi };
}

type User = ReturnType<typeof userEvent.setup>;

const rollbackButton = () => screen.getByRole('button', { name: /^Roll back/ });
const pickerInput = () => screen.findByRole('textbox', { name: 'Revision' });

const expectPickerValue = async (name: string) => {
  const input = await pickerInput();
  await waitFor(() => expect(input).toHaveValue(name));
};

const openPicker = async (user: User) => {
  await user.click(await pickerInput());
  await screen.findByRole('listbox', { name: 'Revisions' });
};

const pick = async (user: User, n: number) => {
  await openPicker(user);
  await user.click(screen.getByTestId(`revision-row-${n}`));
};

const openConfirm = async (user: User, n: number) => {
  await pick(user, n);
  await user.click(
    await screen.findByRole('button', { name: `Roll back to r${n}` }),
  );
  return screen.findByRole('dialog');
};

const parsed = (testId: string) =>
  YAML.parse(screen.getByTestId(testId).textContent!);

// Each test drives MUI dialogs end to end, which is slow under a parallel
// run; the default 5s leaves no headroom.
jest.setTimeout(15000);

describe('ResourceRevisionHistorySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermission.canRollback = true;
    mockPermission.deniedTooltip = '';
  });

  it('lists the resource binding revisions newest first, the active one selected', async () => {
    const user = userEvent.setup();
    const listResourceReleaseBindingRevisions = jest
      .fn()
      .mockResolvedValue(history());
    setup({ listResourceReleaseBindingRevisions });

    await expectPickerValue('orders-db-r3');
    expect(screen.getByTestId('revision-selected-meta')).toHaveTextContent(
      '7h ago · Healthy · Override',
    );
    expect(listResourceReleaseBindingRevisions).toHaveBeenCalledWith(
      entity,
      'development',
      'orders-db-development',
    );
    // Permissions key on the environment's resource name, through the
    // resource-side hook only.
    expect(mockResourcePermissionEnv).toHaveBeenCalledWith('development');
    expect(mockComponentPermission).not.toHaveBeenCalled();

    await openPicker(user);
    const rows = screen.getAllByRole('option').map(row => ({
      name: within(row).getByTestId('revision-name').textContent,
      health: within(row).getByTestId('revision-health').textContent,
      active: !!within(row).queryByTestId('revision-active'),
      knownGood: !!within(row).queryByTestId('revision-known-good'),
    }));
    expect(rows).toEqual([
      {
        name: 'orders-db-r3',
        health: 'Healthy',
        active: true,
        knownGood: true,
      },
      {
        name: 'orders-db-r2',
        health: 'Healthy',
        active: false,
        knownGood: true,
      },
      {
        name: 'orders-db-r1',
        health: 'Degraded',
        active: false,
        knownGood: false,
      },
    ]);
  });

  it('views a revision and compares it with the active one in the Revision Browser', async () => {
    const user = userEvent.setup();
    setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue(history()),
    });

    await pick(user, 2);
    await openPicker(user);
    await user.click(screen.getByText('Open Revision Browser'));

    // View: the full ResourceReleaseBindingRevision object.
    const view = parsed('yaml-viewer');
    expect(view.kind).toBe('ResourceReleaseBindingRevision');
    expect(view.metadata.name).toBe('orders-db-development-r2');
    expect(view.spec).toMatchObject({
      revision: 2,
      resourceReleaseName: 'orders-db-v2',
    });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('orders-db-v2').length).toBeGreaterThan(
      0,
    );

    // Compare: side by side against the active revision.
    await user.click(
      screen.getByRole('button', { name: 'Compare with another revision' }),
    );
    await screen.findByTestId('yaml-diff-viewer');
    expect(screen.getByTestId('diff-original-label')).toHaveTextContent(
      /^orders-db-r3 \(/,
    );
    expect(screen.getByTestId('diff-modified-label')).toHaveTextContent(
      'orders-db-r2',
    );
    expect(
      parsed('diff-original').spec.bindingSpec.resourceTypeEnvironmentConfigs,
    ).toEqual({ size: 'large' });
    expect(
      parsed('diff-modified').spec.bindingSpec.resourceTypeEnvironmentConfigs,
    ).toEqual({ size: 'small' });
  });

  it('disables rollback without the resource rollback permission', async () => {
    mockPermission.canRollback = false;
    mockPermission.deniedTooltip =
      'You do not have permission to roll back the resource in development';
    const user = userEvent.setup();
    const rollbackResourceReleaseBinding = jest.fn();
    setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue(history()),
      rollbackResourceReleaseBinding,
    });

    await pick(user, 2);
    expect(rollbackButton()).toBeDisabled();
    await user.hover(rollbackButton().parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'You do not have permission to roll back the resource in development',
    );
    expect(rollbackResourceReleaseBinding).not.toHaveBeenCalled();
  });

  it('dry-runs, confirms through the resource API and polls until the target is active', async () => {
    const user = userEvent.setup();
    let applied = false;
    // No revision is created: r2 becomes active again at Progressing.
    const after = () =>
      history().map(r => {
        if (r.spec.revision === 2) {
          return {
            ...r,
            status: { ...r.status, active: true, health: 'Progressing' },
          } as typeof r;
        }
        if (r.spec.revision === 3) {
          return { ...r, status: { ...r.status, active: false } } as typeof r;
        }
        return r;
      });
    const listResourceReleaseBindingRevisions = jest.fn(async () =>
      applied ? after() : history(),
    );
    const rollbackResourceReleaseBinding = jest.fn(
      async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => {
        if (!dryRun) applied = true;
        return { ...preview, dryRun };
      },
    );
    const rollbackReleaseBinding = jest.fn();
    const { alertApi } = setup({
      listResourceReleaseBindingRevisions,
      rollbackResourceReleaseBinding,
      rollbackReleaseBinding,
    });

    const dialog = await openConfirm(user, 2);
    expect(
      await within(dialog).findByText(
        /No revision is created: orders-db-r2 becomes active again\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/replacing the active orders-db-r3/),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId('rollback-changes')).toHaveTextContent(
      'resourceTypeEnvironmentConfigs{"size":"large"} → {"size":"small"}',
    );
    expect(within(dialog).getByTestId('rollback-warnings')).toHaveTextContent(
      'TargetNotKnownGood: revision 2 never stayed Healthy for the known-good window',
    );
    expect(rollbackResourceReleaseBinding).toHaveBeenLastCalledWith(
      entity,
      'orders-db-development',
      2,
      true,
    );

    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    await waitFor(() =>
      expect(rollbackResourceReleaseBinding).toHaveBeenLastCalledWith(
        entity,
        'orders-db-development',
        2,
        false,
      ),
    );
    expect(rollbackReleaseBinding).not.toHaveBeenCalled();
    expect(alertApi.post).toHaveBeenCalledWith({
      message:
        'Rolled back Development to revision 2: orders-db-r2 is active again.',
      severity: 'success',
      display: 'transient',
    });
    expect(mockRefetch).toHaveBeenCalled();

    // The list is fetched again without a reload and shows r2 active and
    // Progressing; no revision is added.
    await waitFor(() =>
      expect(screen.getByTestId('revision-selected-meta')).toHaveTextContent(
        /Progressing · Deploy/,
      ),
    );
    await expectPickerValue('orders-db-r2');
    await openPicker(user);
    expect(
      within(screen.getByTestId('revision-row-2')).getByTestId(
        'revision-active',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('revision-row-3')).queryByTestId(
        'revision-active',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('explains a deleted ResourceRelease reported by the preview and blocks confirm', async () => {
    const user = userEvent.setup();
    const deleted = await apiError(409, {
      name: 'ConflictError',
      message: 'ResourceRelease orders-db-v1 has been deleted',
      code: 'RELEASE_DELETED',
    });
    setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue(history()),
      rollbackResourceReleaseBinding: jest.fn().mockRejectedValue(deleted),
    });

    // The resource's releases are not listed, so the server decides.
    const dialog = await openConfirm(user, 1);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'The release this revision deployed has been deleted, so it can no longer be restored. ResourceRelease orders-db-v1 has been deleted',
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
    const rollbackResourceReleaseBinding = jest
      .fn()
      .mockResolvedValueOnce(preview)
      .mockRejectedValueOnce(concurrent)
      .mockResolvedValueOnce(preview);
    const { alertApi } = setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue(history()),
      rollbackResourceReleaseBinding,
    });

    const dialog = await openConfirm(user, 2);
    await within(dialog).findByTestId('rollback-warnings');
    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    expect(
      await within(dialog).findByTestId('rollback-apply-error'),
    ).toHaveTextContent(
      'The deployment changed while you were reviewing the rollback.',
    );
    await waitFor(() =>
      expect(rollbackResourceReleaseBinding).toHaveBeenCalledTimes(3),
    );
    expect(rollbackResourceReleaseBinding.mock.calls.map(c => c[3])).toEqual([
      true,
      false,
      true,
    ]);
    expect(alertApi.post).not.toHaveBeenCalled();
  });

  it('shows a clear message when applying is forbidden', async () => {
    const user = userEvent.setup();
    const forbidden = await apiError(403, {
      name: 'NotAllowedError',
      message: 'forbidden',
    });
    setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue(history()),
      rollbackResourceReleaseBinding: jest.fn(
        async (_e: unknown, _b: string, _rev: number, dryRun: boolean) => {
          if (dryRun) return preview;
          throw forbidden;
        },
      ),
    });

    const dialog = await openConfirm(user, 2);
    await within(dialog).findByTestId('rollback-warnings');
    await user.click(within(dialog).getByRole('button', { name: 'Roll back' }));

    expect(
      await within(dialog).findByTestId('rollback-apply-error'),
    ).toHaveTextContent(
      'You do not have permission to roll back this deployment. Contact your administrator.',
    );
  });

  it('reports a failure to load the revisions', async () => {
    setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockRejectedValue(new Error('upstream unavailable')),
    });

    expect(
      await screen.findByText('Could not load revisions: upstream unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Roll back/ }),
    ).not.toBeInTheDocument();
  });

  it('deletes an inactive revision through the resource API', async () => {
    const user = userEvent.setup();
    const deleteResourceReleaseBindingRevision = jest
      .fn()
      .mockImplementation((_e, _b, revisionName: string, dryRun: boolean) =>
        Promise.resolve({
          revisionName,
          revision: 1,
          binding: 'orders-db-development',
          environment: 'development',
          dryRun,
        }),
      );
    const { alertApi } = setup({
      listResourceReleaseBindingRevisions: jest
        .fn()
        .mockResolvedValue(history()),
      deleteResourceReleaseBindingRevision,
    });

    await openPicker(user);
    await user.click(screen.getByText('Open Revision Browser'));
    await user.click(await screen.findByTestId('browser-revision-1'));
    await user.click(screen.getByRole('button', { name: 'Delete r1' }));
    const confirm = await screen.findByRole('button', {
      name: 'Delete revision',
    });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    await waitFor(() =>
      expect(deleteResourceReleaseBindingRevision).toHaveBeenLastCalledWith(
        expect.anything(),
        'orders-db-development',
        'orders-db-development-r1',
        false,
      ),
    );
    expect(alertApi.post).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' }),
    );
    expect(mockComponentPermission).not.toHaveBeenCalled();
  });
});
