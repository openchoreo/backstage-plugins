import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { DynamicCheck } from '../../api/types';
import { useAssistantSavedCheck } from './useAssistantSavedCheck';

const saved: DynamicCheck = {
  id: 'c1',
  type: 'json-rules-engine',
  name: 'Saved by the assistant',
  description: '',
  factIds: ['githubRepositoryFactRetriever'],
  metadata: {},
  rule: { conditions: { all: [] } },
  status: 'draft',
};
const opened: DynamicCheck = { ...saved, name: 'As the form opened it' };

function setup() {
  let answer: (checks: DynamicCheck[]) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const listChecks = jest.fn(
    () =>
      new Promise<DynamicCheck[]>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      }),
  );
  const toastApi = { post: jest.fn() };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestApiProvider
      apis={[
        [dynamicChecksApiRef, { listChecks } as any],
        [toastApiRef, toastApi as any],
      ]}
    >
      {children}
    </TestApiProvider>
  );
  const hook = renderHook(
    ({ initialCheck }: { initialCheck: DynamicCheck | null }) =>
      useAssistantSavedCheck(initialCheck),
    { wrapper, initialProps: { initialCheck: opened as DynamicCheck | null } },
  );
  return {
    hook,
    toastApi,
    answer: (checks: DynamicCheck[]) => act(async () => answer(checks)),
    fail: (error: Error) => act(async () => fail(error)),
  };
}

describe('useAssistantSavedCheck', () => {
  it('shows the saved check and bumps the revision after a reload', async () => {
    const { hook, answer } = setup();

    let reloaded: Promise<void> = Promise.resolve();
    act(() => {
      reloaded = hook.result.current.reloadCheck();
    });
    await answer([saved]);
    await act(() => reloaded);

    expect(hook.result.current.check).toBe(saved);
    expect(hook.result.current.revision).toBe(1);
  });

  it('ignores a reload that answers after the form moved to another check', async () => {
    const { hook, answer } = setup();

    let reloaded: Promise<void> = Promise.resolve();
    act(() => {
      reloaded = hook.result.current.reloadCheck();
    });
    // Closed, then a new check opened before the reload answered.
    hook.rerender({ initialCheck: null });
    await answer([saved]);
    await act(() => reloaded);

    expect(hook.result.current.check).toBeNull();
    // The revision keys the form: a change would remount it and drop the
    // new check's input.
    expect(hook.result.current.revision).toBe(0);
  });

  it("doesn't report a failed reload for a check the form no longer shows", async () => {
    const { hook, fail, toastApi } = setup();

    let reloaded: Promise<void> = Promise.resolve();
    act(() => {
      reloaded = hook.result.current.reloadCheck();
    });
    hook.rerender({ initialCheck: null });
    await fail(new Error('Backstage is down'));
    await act(() => reloaded);

    expect(toastApi.post).not.toHaveBeenCalled();
  });
});
