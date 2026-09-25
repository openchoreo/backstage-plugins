import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { HookRunPage } from './HookRunPage';
import { deriveEnvironmentHooks } from '../hooks/hookModel';
import type { Environment } from '../hooks/useEnvironmentData';

const retryReleaseBindingHook = jest.fn().mockResolvedValue({});
const client = { retryReleaseBindingHook, fetchHookRun: jest.fn() };

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => client,
}));
jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'catalog' },
}));
jest.mock('@openchoreo/backstage-design-system', () => ({
  VerticalTabNav: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
let canUpdate = true;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  DetailPageLayout: ({
    title,
    subtitle,
    actions,
    children,
  }: Record<string, React.ReactNode>) => (
    <div>
      <h1>{title}</h1>
      <div>{subtitle}</div>
      <div data-testid="actions">{actions}</div>
      {children}
    </div>
  ),
  formatRelativeTime: () => '1 minute ago',
  useOpenChoreoQuery: () => ({ data: undefined }),
  useReleaseBindingUpdatePermission: () => ({
    canUpdate,
    deniedTooltip: 'no releasebinding:update',
  }),
}));
jest.mock('./HookRunSteps', () => ({
  HookRunSteps: ({ runName, view }: { runName: string; view: string }) => (
    <div data-testid="steps">{`${view}:${runName}`}</div>
  ),
}));

const environment = {
  name: 'Prod-kpop',
  resourceName: 'prod-kpop',
  bindingName: 'kpop-greeter-prod-kpop',
  deployment: { releaseName: 'kpop-greeter-abc' },
  endpoints: [],
} as unknown as Environment;

const hooksWith = (phase: string, mode?: 'Sync' | 'Async') =>
  deriveEnvironmentHooks(
    {
      preDeploy: [
        {
          name: 'image-scan',
          hookRef: { kind: 'ClusterHook', name: 'trivy' },
          mode,
        },
      ],
    },
    phase
      ? {
          preDeploy: [
            {
              name: 'image-scan',
              phase: phase as any,
              workflowRunRef: 'image-scan-pre-trivy-1',
              message: 'CVE-2025-68121',
            },
          ],
        }
      : undefined,
  ).pre[0];

const renderPage = (hook = hooksWith('Failed'), onRetried = jest.fn()) =>
  render(
    <HookRunPage
      environment={environment}
      hook={hook}
      namespaceName="default"
      catalogNamespace="default"
      onBack={jest.fn()}
      onRetried={onRetried}
    />,
  );

beforeEach(() => {
  canUpdate = true;
  retryReleaseBindingHook.mockClear();
});

describe('HookRunPage', () => {
  it('explains that a blocking failure kept the release out of the environment', () => {
    renderPage();
    expect(screen.getByTestId('hook-run-banner')).toHaveTextContent(
      'Deployment blocked. image-scan failed, so kpop-greeter-abc was not deployed to Prod-kpop. CVE-2025-68121.',
    );
    expect(screen.getByTestId('steps')).toHaveTextContent(
      'logs:image-scan-pre-trivy-1',
    );
  });

  it('retries the failed hook on the release binding and refreshes the gate', async () => {
    const onRetried = jest.fn();
    renderPage(hooksWith('Failed'), onRetried);
    fireEvent.click(screen.getByRole('button', { name: /retry hook/i }));
    await waitFor(() => expect(onRetried).toHaveBeenCalled());
    expect(retryReleaseBindingHook).toHaveBeenCalledWith(
      'default',
      'kpop-greeter-prod-kpop',
      'image-scan',
      'preDeploy',
    );
  });

  it('disables retry without releasebinding:update', () => {
    canUpdate = false;
    renderPage();
    expect(screen.getByRole('button', { name: /retry hook/i })).toBeDisabled();
  });

  // Retry only re-runs a Sync hook that failed; there is nothing to retry on a
  // passing, running or async hook.
  it('offers no retry for a hook that did not fail or is async', () => {
    renderPage(hooksWith('Succeeded'));
    expect(screen.queryByRole('button', { name: /retry hook/i })).toBeNull();
    cleanup();
    renderPage(hooksWith('Failed', 'Async'));
    expect(screen.getByTestId('hook-run-banner')).toHaveTextContent(
      'it runs asynchronously',
    );
    expect(screen.queryByRole('button', { name: /retry hook/i })).toBeNull();
  });

  it('says when a hook has not run yet instead of loading logs', () => {
    renderPage(hooksWith(''));
    expect(screen.queryByTestId('steps')).toBeNull();
    expect(
      screen.getByText(
        'This hook runs before the next release deploys to Prod-kpop.',
      ),
    ).toBeInTheDocument();
  });
});
