import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReleaseBindingRevision } from '@openchoreo/backstage-plugin-common';
import YAML from 'yaml';
import {
  matchesRevision,
  RevisionBrowserDialog,
  type RevisionBrowserDialogProps,
} from './RevisionBrowserDialog';

jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
}));

// CodeMirror's MergeView does not run under jsdom; render what it is given.
// Mocking only YamlDiffViewer keeps Backstage's layout code out of the test.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
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

const makeRevision = (
  n: number,
  opts: {
    health?: string;
    active?: boolean;
    cause?: string;
    replicas?: number;
  } = {},
): ReleaseBindingRevision =>
  ({
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ReleaseBindingRevision',
    metadata: {
      name: `frontend-development-r${n}`,
      namespace: 'default',
      creationTimestamp: new Date().toISOString(),
      managedFields: [{ manager: 'controller' }],
    },
    spec: {
      revision: n,
      cause: opts.cause ?? 'Deploy',
      snapshotHash: `hash-${n}`,
      bindingSpec: {
        owner: { projectName: 'shop', componentName: 'frontend' },
        releaseName: `frontend-v${n}`,
        componentTypeEnvironmentConfigs: { replicas: opts.replicas ?? 1 },
      },
    },
    status: {
      health: opts.health ?? 'Healthy',
      active: opts.active ?? false,
      knownGood: true,
    },
  } as unknown as ReleaseBindingRevision);

// Newest first, as the panel passes them.
const revisions = [
  makeRevision(4, { active: true, cause: 'Override', replicas: 3 }),
  makeRevision(3, { health: 'Degraded' }),
  makeRevision(2, { cause: 'Promote' }),
  makeRevision(1),
];

function setup(props: Partial<RevisionBrowserDialogProps> = {}) {
  const onRollback = jest.fn();
  render(
    <RevisionBrowserDialog
      open
      onClose={jest.fn()}
      revisions={revisions}
      environmentName="Development"
      releaseNames={new Set(['frontend-v2', 'frontend-v3', 'frontend-v4'])}
      initialRevisionName="frontend-development-r2"
      rollbackBlockedReason={rev =>
        rev.status?.active ? 'Already active.' : null
      }
      onRollback={onRollback}
      {...props}
    />,
  );
  return { onRollback };
}

const listedNumbers = () =>
  screen
    .getAllByTestId(/^browser-revision-/)
    .map(el =>
      el.getAttribute('data-testid')!.replace('browser-revision-', ''),
    );

const parsed = (testId: string) =>
  YAML.parse(screen.getByTestId(testId).textContent!);

describe('RevisionBrowserDialog', () => {
  it('lists every revision newest first, marking the active one deployed', () => {
    setup();
    expect(screen.getByText('Select revision')).toBeInTheDocument();
    expect(listedNumbers()).toEqual(['4', '3', '2', '1']);
    expect(screen.getByText('Showing 4 of 4')).toBeInTheDocument();
    const active = screen.getByTestId('browser-revision-4');
    expect(within(active).getByText('frontend-r4')).toBeInTheDocument();
    expect(within(active).getByText('Development')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('browser-revision-3')).getByText(
        /Degraded · Deploy/,
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ['r3', ['3']],
    ['frontend-r3', ['3']],
    ['degraded', ['3']],
    ['promote', ['2']],
    ['active', ['4']],
  ])('search %p shows %p', async (query, expected) => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText('Search revisions'), query);
    expect(listedNumbers()).toEqual(expected);
  });

  it('views the full ReleaseBindingRevision object', () => {
    setup();

    expect(screen.getByText('Manifest')).toBeInTheDocument();
    const doc = parsed('yaml-viewer');
    expect(doc.apiVersion).toBe('openchoreo.dev/v1alpha1');
    expect(doc.kind).toBe('ReleaseBindingRevision');
    expect(doc.metadata.name).toBe('frontend-development-r2');
    expect(doc.metadata).not.toHaveProperty('managedFields');
    expect(doc.spec).toMatchObject({
      revision: 2,
      cause: 'Promote',
      bindingSpec: { releaseName: 'frontend-v2' },
    });
    expect(doc.status).toMatchObject({ health: 'Healthy', active: false });
  });

  it('compares two full ReleaseBindingRevision objects, the active one by default', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(
      screen.getByRole('button', { name: 'Compare with another revision' }),
    );

    await screen.findByTestId('yaml-diff-viewer');
    expect(screen.getByTestId('diff-original-label')).toHaveTextContent(
      /^frontend-r4 \(/,
    );
    expect(screen.getByTestId('diff-modified-label')).toHaveTextContent(
      'frontend-r2',
    );
    const [original, modified] = [
      parsed('diff-original'),
      parsed('diff-modified'),
    ];
    expect(original.kind).toBe('ReleaseBindingRevision');
    expect(modified.kind).toBe('ReleaseBindingRevision');
    expect(original.spec.bindingSpec.componentTypeEnvironmentConfigs).toEqual({
      replicas: 3,
    });
    expect(modified.spec.bindingSpec.componentTypeEnvironmentConfigs).toEqual({
      replicas: 1,
    });
    expect(original.status.active).toBe(true);
    expect(modified.status.active).toBe(false);
  });

  it('compares with another revision picked in "Compare with"', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(
      screen.getByRole('button', { name: 'Compare with another revision' }),
    );
    await user.click(screen.getByLabelText('Compare with'));
    await user.click(
      within(await screen.findByRole('listbox')).getByText('frontend-r3'),
    );

    await waitFor(() =>
      expect(screen.getByTestId('diff-original-label')).toHaveTextContent(
        /^frontend-r3 \(/,
      ),
    );
    expect(parsed('diff-original').metadata.name).toBe(
      'frontend-development-r3',
    );
  });

  it('never compares a revision with itself', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(
      screen.getByRole('button', { name: 'Compare with another revision' }),
    );
    await screen.findByTestId('yaml-diff-viewer');
    // r4, the active revision, is being compared with; highlight it.
    await user.click(screen.getByTestId('browser-revision-4'));

    expect(
      await screen.findByText('Pick a revision to compare against.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('yaml-diff-viewer')).not.toBeInTheDocument();
  });

  it('clicking a list row changes the revision shown', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByTestId('browser-revision-3'));
    expect(parsed('yaml-viewer').metadata.name).toBe('frontend-development-r3');
  });

  it('marks a revision whose release was deleted', () => {
    setup();
    const r1 = screen.getByTestId('browser-revision-1');
    expect(within(r1).getByText('release deleted')).toBeInTheDocument();
  });

  it('rolls back to the highlighted revision unless blocked', async () => {
    const user = userEvent.setup();
    const { onRollback } = setup();

    await user.click(screen.getByRole('button', { name: 'Roll back to r2' }));
    expect(onRollback).toHaveBeenCalledWith(revisions[2]);

    await user.click(screen.getByTestId('browser-revision-4'));
    expect(
      screen.getByRole('button', { name: 'Roll back to r4' }),
    ).toBeDisabled();
  });
});

describe('RevisionBrowserDialog deleting', () => {
  it('offers to delete the highlighted revision unless blocked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    setup({
      onDelete,
      deleteBlockedReason: rev =>
        rev.status?.active ? 'frontend-r4 is currently active.' : null,
    });

    await user.click(screen.getByRole('button', { name: 'Delete r2' }));
    expect(onDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: expect.objectContaining({ revision: 2 }),
      }),
    );

    await user.click(screen.getByTestId('browser-revision-4'));
    expect(screen.getByRole('button', { name: 'Delete r4' })).toBeDisabled();
  });

  it('places the history limit control in the footer after Delete', () => {
    setup({
      onDelete: jest.fn(),
      historyLimitControl: <button type="button">History limit: 10</button>,
    });

    const del = screen.getByRole('button', { name: 'Delete r2' });
    const limit = screen.getByRole('button', { name: 'History limit: 10' });
    expect(del.compareDocumentPosition(limit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const rollback = screen.getByRole('button', { name: 'Roll back to r2' });
    expect(limit.compareDocumentPosition(rollback)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('shows the history limit control without a delete action', () => {
    setup({
      historyLimitControl: <button type="button">History limit: 10</button>,
    });
    expect(
      screen.getByRole('button', { name: 'History limit: 10' }),
    ).toBeInTheDocument();
  });

  it('offers no delete without onDelete', () => {
    setup();
    expect(
      screen.queryByRole('button', { name: /^Delete r/ }),
    ).not.toBeInTheDocument();
  });

  it('lists missing numbers as unavailable, not as revisions', () => {
    setup({
      revisions: [
        makeRevision(6, { active: true }),
        makeRevision(3),
        makeRevision(2),
      ],
      initialRevisionName: 'frontend-development-r6',
    });

    const gap = screen.getByTestId('browser-gap-4');
    expect(gap).toHaveTextContent('r4–r5');
    expect(gap).toHaveTextContent('Unavailable');
    expect(gap).toHaveAttribute('aria-label', 'r4–r5 no longer available');
    expect(screen.queryByTestId('browser-revision-4')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument();
  });

  it('says so when the highlighted revision is deleted while open', () => {
    const props = {
      open: true,
      onClose: jest.fn(),
      environmentName: 'Development',
      releaseNames: null,
      initialRevisionName: 'frontend-development-r3',
      rollbackBlockedReason: () => null,
      onRollback: jest.fn(),
      onDelete: jest.fn(),
    };
    const { rerender } = render(
      <RevisionBrowserDialog {...props} revisions={revisions} />,
    );
    rerender(
      <RevisionBrowserDialog
        {...props}
        revisions={revisions.filter(r => r.spec.revision !== 3)}
      />,
    );

    expect(screen.getByTestId('revision-gone')).toHaveTextContent(
      'frontend-development-r3 is no longer available: it has been deleted.',
    );
    expect(
      screen.queryByRole('button', { name: /^Roll back to/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Delete r/ }),
    ).not.toBeInTheDocument();
  });
});

describe('matchesRevision', () => {
  // Real release names end in a hash, so they are full of digits.
  const hashed = (n: number, release: string) =>
    ({
      metadata: { name: `api-development-r${n}` },
      spec: {
        revision: n,
        cause: 'Deploy',
        bindingSpec: {
          owner: { projectName: 'shop', componentName: 'api' },
          releaseName: release,
        },
      },
      status: { health: 'Healthy', active: false },
    } as unknown as ReleaseBindingRevision);
  const revs = [
    hashed(6, 'api-559db76545'),
    hashed(2, 'api-66bb74896b'),
    hashed(16, 'api-7c3a9b2d10'),
    hashed(1, 'api-58f775679d'),
  ];
  const matching = (q: string) =>
    revs.filter(r => matchesRevision(r, q)).map(r => r.spec.revision);

  it('treats r<N> as the revision number, not a substring of release hashes', () => {
    expect(matching('r6')).toEqual([6]);
    expect(matching('R16')).toEqual([16]);
    expect(matching(' r1 ')).toEqual([1]);
  });

  it('still searches every field for anything else', () => {
    expect(matching('6')).toEqual([6, 2, 16, 1]);
    expect(matching('66bb')).toEqual([2]);
    expect(matching('api-559db76545')).toEqual([6]);
    expect(matching('api-r6')).toEqual([6]);
    expect(matching('healthy')).toHaveLength(4);
  });

  it('searches the change message', () => {
    const withMessage = {
      ...hashed(3, 'api-0a1b2c3d4e'),
      spec: {
        revision: 3,
        cause: 'Deploy',
        bindingSpec: {
          owner: { projectName: 'shop', componentName: 'api' },
          releaseName: 'api-0a1b2c3d4e',
        },
        message: 'Fix checkout timeout',
      },
    } as unknown as ReleaseBindingRevision;
    expect(matchesRevision(withMessage, 'checkout')).toBe(true);
    expect(matching('checkout')).toEqual([]);
  });
});
