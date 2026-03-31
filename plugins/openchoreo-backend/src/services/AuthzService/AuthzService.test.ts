import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { AuthzService } from './AuthzService';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockPUT = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    PUT: mockPUT,
    DELETE: mockDELETE,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const k8sNamespace = {
  metadata: {
    name: 'org-1',
    annotations: { 'openchoreo.dev/display-name': 'Org 1' },
  },
};

const k8sNamespace2 = {
  metadata: {
    name: 'org-2',
    annotations: { 'openchoreo.dev/display-name': 'Org 2' },
  },
};

const k8sProject = {
  metadata: {
    name: 'proj-1',
    annotations: { 'openchoreo.dev/display-name': 'Project 1' },
  },
};

const k8sComponent = {
  metadata: {
    name: 'comp-1',
    annotations: { 'openchoreo.dev/display-name': 'Component 1' },
  },
};

const k8sClusterRole = {
  metadata: {
    name: 'admin',
    annotations: { description: 'Admin role' },
    labels: { tier: 'platform' },
  },
  spec: { actions: ['read', 'write'] },
};

const k8sClusterRole2 = {
  metadata: {
    name: 'viewer',
    annotations: { description: 'Viewer role' },
    labels: {},
  },
  spec: { actions: ['read'] },
};

const k8sNamespaceRole = {
  metadata: {
    name: 'ns-editor',
    annotations: { description: 'Namespace editor' },
    labels: { scope: 'ns' },
  },
  spec: { actions: ['read', 'write', 'delete'] },
};

const k8sClusterRoleBinding = {
  metadata: { name: 'bind-1', labels: {} },
  spec: {
    roleMappings: [
      {
        roleRef: { kind: 'ClusterAuthzRole', name: 'admin' },
        scope: { project: 'proj-1' },
      },
    ],
    entitlement: { claim: 'email', value: 'user@org.com' },
    effect: 'allow',
  },
};

const k8sClusterRoleBinding2 = {
  metadata: { name: 'bind-2', labels: {} },
  spec: {
    roleMappings: [
      { roleRef: { kind: 'ClusterAuthzRole', name: 'viewer' } },
    ],
    entitlement: { claim: 'group', value: 'devs' },
    effect: 'deny',
  },
};

const k8sNsRoleBinding = {
  metadata: { name: 'ns-bind-1', labels: {} },
  spec: {
    roleMappings: [
      {
        roleRef: { kind: 'AuthzRole', name: 'ns-editor' },
        scope: { project: 'proj-1' },
      },
    ],
    entitlement: { claim: 'email', value: 'dev@org.com' },
    effect: 'allow',
  },
};

const k8sNsRoleBindingClusterRef = {
  metadata: { name: 'ns-bind-2', labels: {} },
  spec: {
    roleMappings: [
      { roleRef: { kind: 'ClusterAuthzRole', name: 'admin' } },
    ],
    entitlement: { claim: 'group', value: 'admins' },
    effect: 'allow',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

function createService() {
  return new AuthzService(mockLogger, 'http://test:8080');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthzService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Actions & User Types
  // =========================================================================

  describe('listActions', () => {
    it('returns actions', async () => {
      const actions = [
        { name: 'read', description: 'Read' },
        { name: 'write', description: 'Write' },
      ];
      mockGET.mockResolvedValueOnce(createOkResponse(actions));

      const result = await createService().listActions();

      expect(result.data).toEqual(actions);
    });

    it('returns empty array when data is null', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(null));

      const result = await createService().listActions();

      expect(result.data).toEqual([]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(createService().listActions()).rejects.toThrow();
    });
  });

  describe('listUserTypes', () => {
    it('returns user types', async () => {
      const types = [
        { name: 'human', claim: 'email' },
        { name: 'service', claim: 'client_id' },
      ];
      mockGET.mockResolvedValueOnce(createOkResponse(types));

      const result = await createService().listUserTypes();

      expect(result.data).toEqual(types);
    });

    it('returns empty array when data is null', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(null));

      const result = await createService().listUserTypes();

      expect(result.data).toEqual([]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(createService().listUserTypes()).rejects.toThrow();
    });
  });

  // =========================================================================
  // Hierarchy (fetchAllPages)
  // =========================================================================

  describe('listNamespaces', () => {
    it('transforms K8s items to { name, displayName }', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sNamespace, k8sNamespace2],
          pagination: {},
        }),
      );

      const result = await createService().listNamespaces();

      expect(result.data).toEqual([
        { name: 'org-1', displayName: 'Org 1' },
        { name: 'org-2', displayName: 'Org 2' },
      ]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(createService().listNamespaces()).rejects.toThrow();
    });
  });

  describe('deleteNamespace', () => {
    it('deletes successfully', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: undefined,
          response: { ok: true, status: 200 },
        });

      await expect(
        createService().deleteNamespace('org-1'),
      ).resolves.toBeUndefined();

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: { message: 'fail' },
          response: { ok: false, status: 404, statusText: 'Not Found' },
        });

      await expect(
        createService().deleteNamespace('org-1'),
      ).rejects.toThrow();
    });
  });

  describe('listProjects', () => {
    it('transforms K8s items to { name, displayName }', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sProject],
          pagination: {},
        }),
      );

      const result = await createService().listProjects('org-1');

      expect(result.data).toEqual([
        { name: 'proj-1', displayName: 'Project 1' },
      ]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().listProjects('org-1'),
      ).rejects.toThrow();
    });
  });

  describe('listComponents', () => {
    it('transforms K8s items to { name, displayName }', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [k8sComponent],
          pagination: {},
        }),
      );

      const result = await createService().listComponents('org-1', 'proj-1');

      expect(result.data).toEqual([
        { name: 'comp-1', displayName: 'Component 1' },
      ]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().listComponents('org-1', 'proj-1'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Cluster Roles (CRUD)
  // =========================================================================

  describe('listClusterRoles', () => {
    it('transforms K8s items to flat role objects', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sClusterRole, k8sClusterRole2] }),
      );

      const result = await createService().listClusterRoles();

      expect(result.data).toEqual([
        {
          name: 'admin',
          actions: ['read', 'write'],
          description: 'Admin role',
          labels: { tier: 'platform' },
        },
        {
          name: 'viewer',
          actions: ['read'],
          description: 'Viewer role',
          labels: {},
        },
      ]);
    });

    it('returns empty when items is undefined', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse({}));

      const result = await createService().listClusterRoles();

      expect(result.data).toEqual([]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(createService().listClusterRoles()).rejects.toThrow();
    });
  });

  describe('getClusterRole', () => {
    it('transforms single K8s role to flat shape', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sClusterRole));

      const result = await createService().getClusterRole('admin');

      expect(result.data).toEqual({
        name: 'admin',
        actions: ['read', 'write'],
        description: 'Admin role',
      });
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().getClusterRole('admin'),
      ).rejects.toThrow();
    });
  });

  describe('createClusterRole', () => {
    it('posts K8s-structured body', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sClusterRole));

      const result = await createService().createClusterRole({
        name: 'admin',
        actions: ['read', 'write'],
        description: 'Admin role',
      });

      expect(result.data).toBeDefined();
      expect(mockPOST).toHaveBeenCalledTimes(1);
      const body = mockPOST.mock.calls[0][1].body;
      expect(body.metadata.name).toBe('admin');
      expect(body.metadata.annotations.description).toBe('Admin role');
      expect(body.spec.actions).toEqual(['read', 'write']);
    });

    it('omits annotations when description is undefined', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sClusterRole));

      await createService().createClusterRole({
        name: 'admin',
        actions: ['read'],
      });

      const body = mockPOST.mock.calls[0][1].body;
      expect(body.metadata.annotations).toBeUndefined();
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().createClusterRole({
          name: 'admin',
          actions: ['read'],
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateClusterRole', () => {
    it('puts K8s-structured body', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(k8sClusterRole));

      const result = await createService().updateClusterRole('admin', {
        actions: ['read', 'write'],
        description: 'Updated',
      });

      expect(result.data).toBeDefined();
      expect(mockPUT).toHaveBeenCalledTimes(1);
      const call = mockPUT.mock.calls[0];
      expect(call[1].params.path.name).toBe('admin');
      expect(call[1].body.spec.actions).toEqual(['read', 'write']);
    });

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().updateClusterRole('admin', { actions: ['read'] }),
      ).rejects.toThrow();
    });
  });

  describe('deleteClusterRole', () => {
    it('deletes successfully', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: undefined,
          response: { ok: true, status: 200 },
        });

      await expect(
        createService().deleteClusterRole('admin'),
      ).resolves.toBeUndefined();

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: { message: 'fail' },
          response: { ok: false, status: 404, statusText: 'Not Found' },
        });

      await expect(
        createService().deleteClusterRole('admin'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Namespace Roles (CRUD)
  // =========================================================================

  describe('listNamespaceRoles', () => {
    it('transforms items and adds namespace field', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({ items: [k8sNamespaceRole] }),
      );

      const result = await createService().listNamespaceRoles('org-1');

      expect(result.data).toEqual([
        {
          name: 'ns-editor',
          actions: ['read', 'write', 'delete'],
          namespace: 'org-1',
          description: 'Namespace editor',
          labels: { scope: 'ns' },
        },
      ]);
    });

    it('returns empty when items is undefined', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse({}));

      const result = await createService().listNamespaceRoles('org-1');

      expect(result.data).toEqual([]);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().listNamespaceRoles('org-1'),
      ).rejects.toThrow();
    });
  });

  describe('getNamespaceRole', () => {
    it('transforms and includes namespace', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sNamespaceRole));

      const result = await createService().getNamespaceRole(
        'org-1',
        'ns-editor',
      );

      expect(result.data).toEqual({
        name: 'ns-editor',
        actions: ['read', 'write', 'delete'],
        namespace: 'org-1',
        description: 'Namespace editor',
      });
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().getNamespaceRole('org-1', 'ns-editor'),
      ).rejects.toThrow();
    });
  });

  describe('createNamespaceRole', () => {
    it('posts with namespace path param', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sNamespaceRole));

      const result = await createService().createNamespaceRole({
        name: 'ns-editor',
        namespace: 'org-1',
        actions: ['read', 'write', 'delete'],
        description: 'Namespace editor',
      });

      expect(result.data).toBeDefined();
      const call = mockPOST.mock.calls[0];
      expect(call[1].params.path.namespaceName).toBe('org-1');
      expect(call[1].body.metadata.name).toBe('ns-editor');
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().createNamespaceRole({
          name: 'ns-editor',
          namespace: 'org-1',
          actions: ['read'],
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateNamespaceRole', () => {
    it('puts with namespace and name path params', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(k8sNamespaceRole));

      const result = await createService().updateNamespaceRole(
        'org-1',
        'ns-editor',
        { actions: ['read'], description: 'Updated' },
      );

      expect(result.data).toBeDefined();
      const call = mockPUT.mock.calls[0];
      expect(call[1].params.path.namespaceName).toBe('org-1');
      expect(call[1].params.path.name).toBe('ns-editor');
    });

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().updateNamespaceRole('org-1', 'ns-editor', {
          actions: ['read'],
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteNamespaceRole', () => {
    it('deletes successfully', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: undefined,
          response: { ok: true, status: 200 },
        });

      await expect(
        createService().deleteNamespaceRole('org-1', 'ns-editor'),
      ).resolves.toBeUndefined();

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: { message: 'fail' },
          response: { ok: false, status: 404, statusText: 'Not Found' },
        });

      await expect(
        createService().deleteNamespaceRole('org-1', 'ns-editor'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Cluster Role Bindings (CRUD + client-side filtering)
  // =========================================================================

  describe('listClusterRoleBindings', () => {
    const apiResponse = createOkResponse({
      items: [k8sClusterRoleBinding, k8sClusterRoleBinding2],
    });

    it('returns all bindings without filters', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings();

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        name: 'bind-1',
        roleMappings: [
          { role: 'admin', scope: { project: 'proj-1' } },
        ],
        entitlement: { claim: 'email', value: 'user@org.com' },
        effect: 'allow',
        labels: {},
      });
    });

    it('filters by roleName', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings({
        roleName: 'admin',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('bind-1');
    });

    it('filters by claim', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings({
        claim: 'group',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('bind-2');
    });

    it('filters by value', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings({
        value: 'user@org.com',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('bind-1');
    });

    it('filters by effect', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings({
        effect: 'deny',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('bind-2');
    });

    it('applies multiple filters (AND logic)', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings({
        roleName: 'viewer',
        effect: 'deny',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('bind-2');
    });

    it('returns empty when no bindings match filters', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listClusterRoleBindings({
        roleName: 'admin',
        effect: 'deny',
      });

      expect(result.data).toHaveLength(0);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().listClusterRoleBindings(),
      ).rejects.toThrow();
    });
  });

  describe('getClusterRoleBinding', () => {
    it('transforms single binding', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse(k8sClusterRoleBinding),
      );

      const result = await createService().getClusterRoleBinding('bind-1');

      expect(result.data).toEqual({
        name: 'bind-1',
        roleMappings: [
          { role: 'admin', scope: { project: 'proj-1' } },
        ],
        entitlement: { claim: 'email', value: 'user@org.com' },
        effect: 'allow',
      });
    });

    it('defaults effect to allow when missing', async () => {
      const noEffect = {
        metadata: { name: 'bind-x' },
        spec: {
          roleMappings: [],
          entitlement: { claim: 'email', value: 'a@b.com' },
        },
      };
      mockGET.mockResolvedValueOnce(createOkResponse(noEffect));

      const result = await createService().getClusterRoleBinding('bind-x');

      expect(result.data.effect).toBe('allow');
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().getClusterRoleBinding('bind-1'),
      ).rejects.toThrow();
    });
  });

  describe('createClusterRoleBinding', () => {
    it('creates with ClusterAuthzRole roleRef kind', async () => {
      mockPOST.mockResolvedValueOnce(
        createOkResponse(k8sClusterRoleBinding),
      );

      const result = await createService().createClusterRoleBinding({
        name: 'bind-1',
        roleMappings: [
          { role: 'admin', scope: { project: 'proj-1' } },
        ],
        entitlement: { claim: 'email', value: 'user@org.com' },
        effect: 'allow',
      });

      expect(result.data.name).toBe('bind-1');
      const body = mockPOST.mock.calls[0][1].body;
      expect(body.spec.roleMappings[0].roleRef).toEqual({
        kind: 'ClusterAuthzRole',
        name: 'admin',
      });
      expect(body.spec.roleMappings[0].scope).toEqual({
        project: 'proj-1',
      });
    });

    it('omits scope when not provided', async () => {
      mockPOST.mockResolvedValueOnce(
        createOkResponse(k8sClusterRoleBinding2),
      );

      await createService().createClusterRoleBinding({
        name: 'bind-2',
        roleMappings: [{ role: 'viewer' }],
        entitlement: { claim: 'group', value: 'devs' },
      });

      const body = mockPOST.mock.calls[0][1].body;
      expect(body.spec.roleMappings[0].scope).toBeUndefined();
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().createClusterRoleBinding({
          name: 'bind-1',
          roleMappings: [{ role: 'admin' }],
          entitlement: { claim: 'email', value: 'a@b.com' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateClusterRoleBinding', () => {
    it('puts with path name and body', async () => {
      mockPUT.mockResolvedValueOnce(
        createOkResponse(k8sClusterRoleBinding),
      );

      const result = await createService().updateClusterRoleBinding(
        'bind-1',
        {
          roleMappings: [
            { role: 'admin', scope: { project: 'proj-1' } },
          ],
          entitlement: { claim: 'email', value: 'user@org.com' },
          effect: 'allow',
        },
      );

      expect(result.data.name).toBe('bind-1');
      expect(mockPUT).toHaveBeenCalledTimes(1);
      const call = mockPUT.mock.calls[0];
      expect(call[1].params.path.name).toBe('bind-1');
    });

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().updateClusterRoleBinding('bind-1', {
          roleMappings: [{ role: 'admin' }],
          entitlement: { claim: 'email', value: 'a@b.com' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteClusterRoleBinding', () => {
    it('deletes successfully', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: undefined,
          response: { ok: true, status: 200 },
        });

      await expect(
        createService().deleteClusterRoleBinding('bind-1'),
      ).resolves.toBeUndefined();

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: { message: 'fail' },
          response: { ok: false, status: 404, statusText: 'Not Found' },
        });

      await expect(
        createService().deleteClusterRoleBinding('bind-1'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Namespace Role Bindings (CRUD + filtering)
  // =========================================================================

  describe('listNamespaceRoleBindings', () => {
    const apiResponse = createOkResponse({
      items: [k8sNsRoleBinding, k8sNsRoleBindingClusterRef],
    });

    it('returns all bindings without filters', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1');

      expect(result.data).toHaveLength(2);
      // AuthzRole kind -> role.namespace is set to the binding namespace
      expect(result.data[0]).toEqual({
        name: 'ns-bind-1',
        namespace: 'org-1',
        roleMappings: [
          {
            role: { name: 'ns-editor', namespace: 'org-1' },
            scope: { project: 'proj-1' },
          },
        ],
        entitlement: { claim: 'email', value: 'dev@org.com' },
        effect: 'allow',
        labels: {},
      });
      // ClusterAuthzRole kind -> role.namespace is undefined
      expect(result.data[1].roleMappings[0].role.namespace).toBeUndefined();
    });

    it('filters by roleName', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1', {
        roleName: 'ns-editor',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('ns-bind-1');
    });

    it('filters by roleNamespace', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1', {
        roleNamespace: 'org-1',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('ns-bind-1');
    });

    it('filters by claim and value', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1', {
        claim: 'group',
        value: 'admins',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('ns-bind-2');
    });

    it('filters by effect', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1', {
        effect: 'allow',
      });

      expect(result.data).toHaveLength(2);
    });

    it('applies multiple filters (AND logic)', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1', {
        roleName: 'admin',
        claim: 'group',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('ns-bind-2');
    });

    it('returns empty when no bindings match filters', async () => {
      mockGET.mockResolvedValueOnce(apiResponse);

      const result = await createService().listNamespaceRoleBindings('org-1', {
        effect: 'deny',
      });

      expect(result.data).toHaveLength(0);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().listNamespaceRoleBindings('org-1'),
      ).rejects.toThrow();
    });
  });

  describe('getNamespaceRoleBinding', () => {
    it('transforms binding with AuthzRole ref', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(k8sNsRoleBinding));

      const result = await createService().getNamespaceRoleBinding(
        'org-1',
        'ns-bind-1',
      );

      expect(result.data).toEqual({
        name: 'ns-bind-1',
        namespace: 'org-1',
        roleMappings: [
          {
            role: { name: 'ns-editor', namespace: 'org-1' },
            scope: { project: 'proj-1' },
          },
        ],
        entitlement: { claim: 'email', value: 'dev@org.com' },
        effect: 'allow',
      });
    });

    it('transforms binding with ClusterAuthzRole ref (no namespace)', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse(k8sNsRoleBindingClusterRef),
      );

      const result = await createService().getNamespaceRoleBinding(
        'org-1',
        'ns-bind-2',
      );

      expect(result.data.roleMappings[0].role.namespace).toBeUndefined();
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().getNamespaceRoleBinding('org-1', 'ns-bind-1'),
      ).rejects.toThrow();
    });
  });

  describe('createNamespaceRoleBinding', () => {
    it('uses AuthzRole kind when role has namespace', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sNsRoleBinding));

      await createService().createNamespaceRoleBinding({
        name: 'ns-bind-1',
        namespace: 'org-1',
        roleMappings: [
          {
            role: { name: 'ns-editor', namespace: 'org-1' },
            scope: { project: 'proj-1' },
          },
        ],
        entitlement: { claim: 'email', value: 'dev@org.com' },
        effect: 'allow',
      });

      const body = mockPOST.mock.calls[0][1].body;
      expect(body.spec.roleMappings[0].roleRef).toEqual({
        kind: 'AuthzRole',
        name: 'ns-editor',
      });
    });

    it('uses ClusterAuthzRole kind when role has no namespace', async () => {
      mockPOST.mockResolvedValueOnce(
        createOkResponse(k8sNsRoleBindingClusterRef),
      );

      await createService().createNamespaceRoleBinding({
        name: 'ns-bind-2',
        namespace: 'org-1',
        roleMappings: [{ role: { name: 'admin' } }],
        entitlement: { claim: 'group', value: 'admins' },
      });

      const body = mockPOST.mock.calls[0][1].body;
      expect(body.spec.roleMappings[0].roleRef).toEqual({
        kind: 'ClusterAuthzRole',
        name: 'admin',
      });
    });

    it('transforms response correctly', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(k8sNsRoleBinding));

      const result = await createService().createNamespaceRoleBinding({
        name: 'ns-bind-1',
        namespace: 'org-1',
        roleMappings: [
          {
            role: { name: 'ns-editor', namespace: 'org-1' },
          },
        ],
        entitlement: { claim: 'email', value: 'dev@org.com' },
      });

      expect(result.data.name).toBe('ns-bind-1');
      expect(result.data.namespace).toBe('org-1');
      expect(result.data.roleMappings[0].role.namespace).toBe('org-1');
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().createNamespaceRoleBinding({
          name: 'ns-bind-1',
          namespace: 'org-1',
          roleMappings: [{ role: { name: 'ns-editor', namespace: 'org-1' } }],
          entitlement: { claim: 'email', value: 'a@b.com' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateNamespaceRoleBinding', () => {
    it('puts with correct path params and role kind logic', async () => {
      mockPUT.mockResolvedValueOnce(createOkResponse(k8sNsRoleBinding));

      const result = await createService().updateNamespaceRoleBinding(
        'org-1',
        'ns-bind-1',
        {
          roleMappings: [
            {
              role: { name: 'ns-editor', namespace: 'org-1' },
              scope: { project: 'proj-1' },
            },
          ],
          entitlement: { claim: 'email', value: 'dev@org.com' },
          effect: 'allow',
        },
      );

      expect(result.data.name).toBe('ns-bind-1');
      const call = mockPUT.mock.calls[0];
      expect(call[1].params.path.namespaceName).toBe('org-1');
      expect(call[1].params.path.name).toBe('ns-bind-1');
      expect(call[1].body.spec.roleMappings[0].roleRef.kind).toBe(
        'AuthzRole',
      );
    });

    it('throws on API error', async () => {
      mockPUT.mockResolvedValueOnce(createErrorResponse());

      await expect(
        createService().updateNamespaceRoleBinding('org-1', 'ns-bind-1', {
          roleMappings: [{ role: { name: 'ns-editor', namespace: 'org-1' } }],
          entitlement: { claim: 'email', value: 'a@b.com' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('deleteNamespaceRoleBinding', () => {
    it('deletes successfully', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: undefined,
          response: { ok: true, status: 200 },
        });

      await expect(
        createService().deleteNamespaceRoleBinding('org-1', 'ns-bind-1'),
      ).resolves.toBeUndefined();

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
          error: { message: 'fail' },
          response: { ok: false, status: 404, statusText: 'Not Found' },
        });

      await expect(
        createService().deleteNamespaceRoleBinding('org-1', 'ns-bind-1'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Composite: listBindingsForRole
  // =========================================================================

  describe('listBindingsForRole', () => {
    describe('cluster scope', () => {
      it('fetches cluster bindings + namespace bindings for all namespaces', async () => {
        // listClusterRoleBindings -> GET clusterauthzrolebindings
        mockGET.mockResolvedValueOnce(
          createOkResponse({
            items: [k8sClusterRoleBinding],
          }),
        );
        // listNamespaces -> GET namespaces (via fetchAllPages)
        mockGET.mockResolvedValueOnce(
          createOkResponse({
            items: [k8sNamespace],
            pagination: {},
          }),
        );
        // listNamespaceRoleBindings for org-1
        // This binding references ClusterAuthzRole 'admin' (no role.namespace)
        // so the .filter(rm => !rm.role?.namespace) will include it
        mockGET.mockResolvedValueOnce(
          createOkResponse({
            items: [k8sNsRoleBindingClusterRef],
          }),
        );

        const result = await createService().listBindingsForRole(
          'admin',
          'cluster',
        );

        expect(result.clusterRoleBindings).toHaveLength(1);
        expect(result.clusterRoleBindings[0].name).toBe('bind-1');
        expect(result.namespaceRoleBindings).toHaveLength(1);
        expect(result.namespaceRoleBindings[0].name).toBe('ns-bind-2');
        expect(result.namespaceRoleBindings[0].namespace).toBe('org-1');
      });

      it('excludes namespace bindings that reference namespace-scoped roles', async () => {
        mockGET.mockResolvedValueOnce(
          createOkResponse({ items: [] }),
        );
        mockGET.mockResolvedValueOnce(
          createOkResponse({
            items: [k8sNamespace],
            pagination: {},
          }),
        );
        // This binding has AuthzRole kind -> role.namespace will be set
        // so .filter(rm => !rm.role?.namespace) excludes it
        mockGET.mockResolvedValueOnce(
          createOkResponse({
            items: [k8sNsRoleBinding],
          }),
        );

        const result = await createService().listBindingsForRole(
          'ns-editor',
          'cluster',
        );

        expect(result.clusterRoleBindings).toHaveLength(0);
        expect(result.namespaceRoleBindings).toHaveLength(0);
      });
    });

    describe('namespace scope', () => {
      it('fetches only namespace bindings for the given namespace', async () => {
        mockGET.mockResolvedValueOnce(
          createOkResponse({
            items: [k8sNsRoleBinding],
          }),
        );

        const result = await createService().listBindingsForRole(
          'ns-editor',
          'namespace',
          'org-1',
        );

        expect(result.clusterRoleBindings).toEqual([]);
        expect(result.namespaceRoleBindings).toHaveLength(1);
        expect(result.namespaceRoleBindings[0].namespace).toBe('org-1');
      });

      it('throws when roleNamespace is not provided', async () => {
        await expect(
          createService().listBindingsForRole('ns-editor', 'namespace'),
        ).rejects.toThrow('roleNamespace is required');
      });
    });
  });
});
