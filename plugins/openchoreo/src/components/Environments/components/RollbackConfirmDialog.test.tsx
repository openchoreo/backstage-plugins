import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import type {
  ReleaseBindingRevision,
  RollbackResponse,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { RollbackConfirmDialog } from './RollbackConfirmDialog';

const entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'frontend', namespace: 'default' },
};
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity }),
}));

const makeRevision = (n: number): ReleaseBindingRevision =>
  ({
    metadata: { name: `frontend-development-r${n}` },
    spec: {
      revision: n,
      cause: 'Deploy',
      bindingSpec: {
        owner: { projectName: 'shop', componentName: 'frontend' },
        environment: 'development',
        releaseName: `frontend-v${n}`,
      },
    },
    status: { health: 'Healthy', active: false, knownGood: true },
  } as unknown as ReleaseBindingRevision);

const previewOf = (n: number): RollbackResponse => ({
  revisionName: `frontend-development-r${n}`,
  revisionDisplayName: `frontend-r${n}`,
  revision: n,
  targetRevision: n,
  revertedFrom: 4,
  dryRun: true,
  changes: [],
  warnings: [],
});

/** A promise and the function that resolves it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('RollbackConfirmDialog', () => {
  it('ignores a preview that arrives after the target changed', async () => {
    const r1 = deferred<RollbackResponse>();
    const client = {
      rollbackReleaseBinding: jest.fn(
        (_e: unknown, _b: string, target: number) =>
          target === 1 ? r1.promise : Promise.resolve(previewOf(target)),
      ),
    };
    const dialog = (target: ReleaseBindingRevision) => (
      <TestApiProvider apis={[[openChoreoClientApiRef, client]]}>
        <RollbackConfirmDialog
          open
          onClose={jest.fn()}
          bindingName="frontend-development"
          environmentName="Development"
          target={target}
          onRolledBack={jest.fn()}
        />
      </TestApiProvider>
    );

    const { rerender } = render(dialog(makeRevision(1)));
    rerender(dialog(makeRevision(2)));
    expect(
      await screen.findByText(/frontend-r2 becomes active again/),
    ).toBeInTheDocument();

    // r1's preview, requested first, answers last: it must not replace r2's.
    await act(async () => r1.resolve(previewOf(1)));
    expect(
      screen.getByText(/frontend-r2 becomes active again/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/frontend-r1/)).not.toBeInTheDocument();
  });

  // After a rollback the dialog closes, but stays on screen while it fades
  // out, with its target cleared. Its Roll back button must not send
  // another rollback (for revision 0) from there.
  it('sends no rollback from the dialog while it closes', async () => {
    const client = {
      rollbackReleaseBinding: jest.fn(
        (_e: unknown, _b: string, target: number, dryRun: boolean) =>
          Promise.resolve({ ...previewOf(target), dryRun }),
      ),
    };
    const Harness = () => {
      const [target, setTarget] = useState<ReleaseBindingRevision | null>(
        makeRevision(1),
      );
      return (
        <TestApiProvider apis={[[openChoreoClientApiRef, client]]}>
          <RollbackConfirmDialog
            open={target !== null}
            onClose={() => setTarget(null)}
            bindingName="frontend-development"
            environmentName="Development"
            target={target}
            onRolledBack={jest.fn()}
          />
        </TestApiProvider>
      );
    };
    render(<Harness />);
    await screen.findByText(/frontend-r1 becomes active again/);

    const rollBack = () =>
      screen.getByRole('button', { name: 'Roll back', hidden: true });
    await act(async () => {
      fireEvent.click(rollBack());
    });
    expect(client.rollbackReleaseBinding).toHaveBeenCalledTimes(2); // preview, apply

    // Closed and fading out: still rendered, but it sends nothing.
    expect(rollBack()).toBeDisabled();
    await act(async () => {
      fireEvent.click(rollBack());
    });
    expect(client.rollbackReleaseBinding).toHaveBeenCalledTimes(2);
    expect(
      client.rollbackReleaseBinding.mock.calls.map(c => c[2]),
    ).not.toContain(0);
  });
});
