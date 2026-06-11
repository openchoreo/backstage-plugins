import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FailedBuildSnackbar } from './FailedBuildSnackbar';

// Hoisted spies — see InvestigateLogButton.test.tsx for the pattern. Jest
// hoists jest.mock above imports, so the factories below cannot close over
// outer variables; they dereference this holder at call time instead.
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

describe('FailedBuildSnackbar', () => {
  it('passes repoUrl into the openDrawer pin when the component has a workflow repository.url', async () => {
    // The launcher's only job for this code path is to read the URL off
    // componentDetails.componentWorkflow.parameters.repository.url and
    // forward it via the pin so the agent has it on turn 1 — without
    // making the agent run a separate tool call. Mirrors the shape
    // getRepositoryInfo() consumes in @openchoreo/backstage-plugin-common.
    holder.componentDetails = {
      componentWorkflow: {
        name: 'react',
        kind: 'ClusterWorkflow',
        parameters: {
          repository: { url: 'https://github.com/foo/svc-a' },
        },
      },
    };

    render(<FailedBuildSnackbar />);

    const investigate = await screen.findByRole('button', {
      name: /investigate/i,
    });
    fireEvent.click(investigate);

    await waitFor(() => expect(holder.openDrawer).toHaveBeenCalledTimes(1));
    const call = holder.openDrawer.mock.calls[0][0] as {
      pin: { repoUrl?: string; caseType?: string };
    };
    expect(call.pin.caseType).toBe('build_failure');
    expect(call.pin.repoUrl).toBe('https://github.com/foo/svc-a');
  });

  it('falls back to entity metadata when getEntityDetails throws', async () => {
    // Catalog-side resolution can fail (entity missing relationships
    // after a partial sync, transient API hiccup, etc.). The launcher
    // must still open the drawer using the entity's own metadata
    // rather than surfacing an error to the user.
    holder.getEntityDetails = jest
      .fn()
      .mockRejectedValue(new Error('entity not in graph yet'));
    holder.componentDetails = {
      componentWorkflow: {
        parameters: { repository: { url: 'https://github.com/foo/svc-a' } },
      },
    };

    render(<FailedBuildSnackbar />);
    fireEvent.click(
      await screen.findByRole('button', { name: /investigate/i }),
    );

    await waitFor(() => expect(holder.openDrawer).toHaveBeenCalledTimes(1));
    const call = holder.openDrawer.mock.calls[0][0] as {
      pin: { namespace?: string; component?: string; repoUrl?: string };
    };
    // Fallback path uses the entity's own metadata.namespace (when set)
    // and metadata.name — repoUrl still comes off componentDetails so
    // that branch is independent of the entity-details fetch.
    expect(call.pin.component).toBe('svc-a');
    expect(call.pin.namespace).toBe('shop');
    expect(call.pin.repoUrl).toBe('https://github.com/foo/svc-a');
  });

  it('leaves pin.repoUrl undefined when the component has no workflow repository', async () => {
    // Real-world: many components are scaffolded from a non-Git source
    // (sample manifests, OpenChoreo demos). The launcher must NOT
    // fabricate a URL — the agent's prompt explicitly tells the model
    // to omit the Repo: line entirely when scope.repo_url is missing.
    holder.componentDetails = { componentWorkflow: null };

    render(<FailedBuildSnackbar />);

    fireEvent.click(
      await screen.findByRole('button', { name: /investigate/i }),
    );

    await waitFor(() => expect(holder.openDrawer).toHaveBeenCalledTimes(1));
    const call = holder.openDrawer.mock.calls[0][0] as {
      pin: { repoUrl?: string };
    };
    expect(call.pin.repoUrl).toBeUndefined();
  });

  it('leaves pin.repoUrl undefined when componentDetails is null', async () => {
    // useLatestFailedRun returns componentDetails=null while the entity
    // graph is still resolving. The launcher must still open the drawer
    // — without fabricating a repo URL — so the agent's prompt omits
    // the `Repo:` line rather than carrying a stale/invented value.
    holder.componentDetails = null;

    render(<FailedBuildSnackbar />);

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
