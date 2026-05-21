import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BuildPagePromptLauncher } from './BuildPagePromptLauncher';

// Same hoisted-spy pattern as InvestigateLogButton.test.tsx.
const holder: {
  enabled: boolean;
  entity: { kind: string; metadata: { name: string; namespace?: string } };
  componentDetails: unknown;
  latestRun: unknown;
  isFailed: boolean;
  builds: unknown[];
  openDrawer: jest.Mock;
  hasConversation: jest.Mock;
  pathname: string;
  getEntityDetails: jest.Mock;
} = {
  enabled: true,
  entity: { kind: 'Component', metadata: { name: 'svc-a', namespace: 'shop' } },
  componentDetails: null,
  latestRun: undefined,
  isFailed: false,
  builds: [],
  openDrawer: jest.fn(),
  hasConversation: jest.fn(() => false),
  pathname: '/catalog/shop/component/svc-a',
  getEntityDetails: jest.fn(),
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({ entity: holder.entity }),
}));

jest.mock('@openchoreo/backstage-plugin-openchoreo-ci', () => ({
  useLatestFailedRun: () => ({
    builds: holder.builds,
    latestRun: holder.latestRun,
    isFailed: holder.isFailed,
    componentDetails: holder.componentDetails,
  }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAssistantEnabled: () => holder.enabled,
  useComponentEntityDetails: () => ({
    getEntityDetails: holder.getEntityDetails,
  }),
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: holder.pathname }),
}));

jest.mock('../AssistantContext/AssistantDrawerContext', () => ({
  useAssistantDrawer: () => ({
    openDrawer: (...args: unknown[]) => holder.openDrawer(...args),
    hasConversation: (...args: unknown[]) => holder.hasConversation(...args),
  }),
}));

const makeFailedRun = (overrides: Record<string, unknown> = {}) => ({
  name: 'svc-a-build-1',
  status: 'Failed',
  projectName: 'demo',
  ...overrides,
});

beforeEach(() => {
  holder.enabled = true;
  holder.entity = {
    kind: 'Component',
    metadata: { name: 'svc-a', namespace: 'shop' },
  };
  holder.componentDetails = null;
  holder.latestRun = makeFailedRun();
  holder.isFailed = true;
  holder.builds = [holder.latestRun];
  holder.openDrawer = jest.fn();
  holder.hasConversation = jest.fn(() => false);
  holder.pathname = '/catalog/shop/component/svc-a';
  holder.getEntityDetails = jest.fn().mockResolvedValue({
    componentName: 'svc-a',
    projectName: 'demo',
    namespaceName: 'shop',
  });
});

describe('BuildPagePromptLauncher (healthy mode)', () => {
  beforeEach(() => {
    // Override the default failed-run setup from the outer beforeEach
    // so the component falls through to the healthy-mode inline pill.
    holder.isFailed = false;
    holder.latestRun = { name: 'svc-a-build-1', status: 'Succeeded' };
    holder.builds = [holder.latestRun];
  });

  it('renders the inline "Ask AI" pill and opens the drawer with a build_overview scope', async () => {
    // Healthy mode is the always-visible affordance — different
    // openDrawer payload (scopeOverrides, no pin, no caseType-specific
    // initialMessage) and uses the build_overview conversationKey so
    // re-opens land in the same chat instead of starting over.
    render(<BuildPagePromptLauncher />);

    // The Button has an explicit aria-label that overrides the visible
    // "Ask AI" text as the accessible name — query against that.
    fireEvent.click(
      await screen.findByRole('button', {
        name: /open portal assistant to review recent build runs/i,
      }),
    );

    await waitFor(() => expect(holder.openDrawer).toHaveBeenCalledTimes(1));
    const call = holder.openDrawer.mock.calls[0][0] as {
      scopeOverrides?: { caseType?: string; component?: string };
      conversationKey?: string;
      pin?: unknown;
    };
    expect(call.scopeOverrides?.caseType).toBe('build_failure');
    expect(call.scopeOverrides?.component).toBe('svc-a');
    expect(call.conversationKey).toContain('build_overview');
    // No pin in healthy mode — there's no failed run to anchor to.
    expect(call.pin).toBeUndefined();
  });
});

describe('BuildPagePromptLauncher (failed mode)', () => {
  it('forwards repoUrl into the openDrawer pin when the component has a workflow repository.url', async () => {
    // Same plumbing as FailedBuildSnackbar — the agent's BUILD-FAILURE
    // prompt expects scope.repo_url so it can include `Repo: <url>` in
    // the generated fix_prompt without an extra tool call.
    holder.componentDetails = {
      componentWorkflow: {
        name: 'react',
        kind: 'ClusterWorkflow',
        parameters: {
          repository: { url: 'https://github.com/foo/svc-a' },
        },
      },
    };

    render(<BuildPagePromptLauncher />);

    fireEvent.click(
      await screen.findByRole('button', { name: /investigate/i }),
    );

    await waitFor(() => expect(holder.openDrawer).toHaveBeenCalledTimes(1));
    const call = holder.openDrawer.mock.calls[0][0] as {
      pin: { repoUrl?: string; caseType?: string };
    };
    expect(call.pin.caseType).toBe('build_failure');
    expect(call.pin.repoUrl).toBe('https://github.com/foo/svc-a');
  });

  it('leaves pin.repoUrl undefined when componentDetails is null', async () => {
    // useLatestFailedRun returns componentDetails=null while the entity
    // graph is still resolving (or when relationships are missing). The
    // launcher must still open the drawer — without fabricating a repo
    // URL — so the agent's BUILD-FAILURE prompt omits the `Repo:` line
    // rather than carrying a stale or invented value.
    holder.componentDetails = null;

    render(<BuildPagePromptLauncher />);

    fireEvent.click(
      await screen.findByRole('button', { name: /investigate/i }),
    );

    await waitFor(() => expect(holder.openDrawer).toHaveBeenCalledTimes(1));
    const call = holder.openDrawer.mock.calls[0][0] as {
      pin: { repoUrl?: string };
    };
    expect(call.pin.repoUrl).toBeUndefined();
  });
});
