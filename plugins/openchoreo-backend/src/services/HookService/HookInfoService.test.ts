import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { HookInfoService } from './HookInfoService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

const spec = {
  type: 'Workflow',
  workflowRef: { kind: 'ClusterWorkflow', name: 'trivy-image-scan' },
  enabledTo: [{ kind: 'ClusterComponentType', name: 'service' }],
  parameters: [
    { name: 'image', from: '${deployment.workload.containers.main.image}' },
    { name: 'severity', default: 'CRITICAL' },
  ],
};

const k8sClusterHook = {
  metadata: {
    name: 'trivy-image-scan',
    creationTimestamp: '2026-09-23T10:00:00Z',
    annotations: { 'openchoreo.dev/display-name': 'Trivy image scan' },
  },
  spec,
};

const k8sHook = {
  metadata: {
    name: 'slack-notify',
    namespace: 'acme',
    creationTimestamp: '2026-09-23T10:00:00Z',
  },
  spec: { ...spec, workflowRef: { kind: 'Workflow', name: 'slack' } },
};

const mockLogger = mockServices.logger.mock();

function createService() {
  return new HookInfoService(mockLogger, 'http://test:8080');
}

// The portal only reads hooks here; what matters is that the parameter mapping
// and enabledTo reach the caller intact (the pipeline form derives its fields
// from them) and that API errors surface instead of turning into empty lists.
describe('HookInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists cluster hooks with their spec', async () => {
    mockGET.mockResolvedValueOnce(
      createOkResponse({ items: [k8sClusterHook], pagination: {} }),
    );
    const result = await createService().listClusterHooks('token-123');

    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(1);
    const item = result.data!.items![0];
    expect(item.name).toBe('trivy-image-scan');
    expect(item.displayName).toBe('Trivy image scan');
    expect(item.spec.workflowRef).toEqual({
      kind: 'ClusterWorkflow',
      name: 'trivy-image-scan',
    });
    expect(item.spec.enabledTo).toEqual(spec.enabledTo);
    expect(item.spec.parameters).toEqual(spec.parameters);
    expect(mockGET).toHaveBeenCalledWith('/api/v1/clusterhooks', {
      params: { query: { limit: 100, cursor: undefined } },
    });
  });

  it('lists namespaced hooks under the namespace path', async () => {
    mockGET.mockResolvedValueOnce(
      createOkResponse({ items: [k8sHook], pagination: {} }),
    );
    const result = await createService().listHooks('acme', 'token');

    expect(result.data?.items![0].namespaceName).toBe('acme');
    expect(mockGET).toHaveBeenCalledWith(
      '/api/v1/namespaces/{namespaceName}/hooks',
      {
        params: {
          path: { namespaceName: 'acme' },
          query: { limit: 100, cursor: undefined },
        },
      },
    );
  });

  it('gets one hook and one cluster hook by name', async () => {
    mockGET.mockResolvedValueOnce(createOkResponse(k8sHook));
    const hook = await createService().getHook('acme', 'slack-notify');
    expect(hook.data?.name).toBe('slack-notify');

    mockGET.mockResolvedValueOnce(createOkResponse(k8sClusterHook));
    const ch = await createService().getClusterHook('trivy-image-scan');
    expect(ch.data?.name).toBe('trivy-image-scan');
    expect(mockGET).toHaveBeenLastCalledWith(
      '/api/v1/clusterhooks/{clusterHookName}',
      { params: { path: { clusterHookName: 'trivy-image-scan' } } },
    );
  });

  it('throws on API error rather than returning an empty list', async () => {
    mockGET.mockResolvedValueOnce(createErrorResponse());
    await expect(createService().listClusterHooks('token')).rejects.toThrow();
  });
});
