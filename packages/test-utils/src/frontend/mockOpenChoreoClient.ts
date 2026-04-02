/**
 * All method names on the OpenChoreoClientApi interface.
 * Used to auto-generate a mock with every method stubbed as `jest.fn()`.
 *
 * Keep this list in sync with:
 *   plugins/openchoreo/src/api/OpenChoreoClientApi.ts
 */
const methodNames = [
  'fetchEnvironmentInfo',
  'promoteToEnvironment',
  'deleteReleaseBinding',
  'updateComponentBinding',
  'patchComponent',
  'createComponentRelease',
  'deployRelease',
  'fetchComponentRelease',
  'fetchComponentReleaseSchema',
  'fetchReleaseBindings',
  'updateReleaseBinding',
  'patchReleaseBindingOverrides',
  'fetchResourceTree',
  'fetchResourceEvents',
  'fetchPodLogs',
  'fetchWorkloadInfo',
  'applyWorkload',
  'fetchWorkflowSchema',
  'updateComponentWorkflowParameters',
  'getComponentDetails',
  'getProjectDetails',
  'getEnvironments',
  'fetchBuilds',
  'getCellDiagramInfo',
  'fetchTotalBindingsCount',
  'fetchSecretReferences',
  'fetchSecretReferencesByNamespace',
  'fetchDeploymentPipeline',
  'updateProjectPipeline',
  'fetchComponentTraits',
  'updateComponentTraits',
  'fetchComponentTypeSchema',
  'updateComponentConfig',
  'fetchTraitsByNamespace',
  'fetchTraitSchemaByNamespace',
  'fetchClusterTraits',
  'fetchClusterTraitSchema',
  'listActions',
  'listUserTypes',
  'listNamespaces',
  'listProjects',
  'listComponents',
  'fetchDataPlaneDetails',
  'listGitSecrets',
  'createGitSecret',
  'deleteGitSecret',
  'deleteComponent',
  'deleteProject',
  'deleteNamespace',
  'fetchEntityAnnotations',
  'updateEntityAnnotations',
  'getResourceDefinition',
  'updateResourceDefinition',
  'deleteResourceDefinition',
  'listClusterRoles',
  'getClusterRole',
  'createClusterRole',
  'updateClusterRole',
  'deleteClusterRole',
  'listNamespaceRoles',
  'getNamespaceRole',
  'createNamespaceRole',
  'updateNamespaceRole',
  'deleteNamespaceRole',
  'listClusterRoleBindings',
  'getClusterRoleBinding',
  'createClusterRoleBinding',
  'updateClusterRoleBinding',
  'deleteClusterRoleBinding',
  'listNamespaceRoleBindings',
  'getNamespaceRoleBinding',
  'createNamespaceRoleBinding',
  'updateNamespaceRoleBinding',
  'deleteNamespaceRoleBinding',
  'listBindingsForClusterRole',
  'listBindingsForNamespaceRole',
] as const;

/**
 * A fully-mocked OpenChoreoClientApi where every method is a `jest.fn()`.
 * Use with `TestApiProvider` to inject into components under test.
 *
 * @example
 * ```tsx
 * import { TestApiProvider } from '@backstage/test-utils';
 * import { openChoreoClientApiRef } from '@openchoreo/backstage-plugin';
 * import { createMockOpenChoreoClient } from '@openchoreo/test-utils';
 *
 * const mockClient = createMockOpenChoreoClient();
 * mockClient.getEnvironments.mockResolvedValue([...]);
 *
 * render(
 *   <TestApiProvider apis={[[openChoreoClientApiRef, mockClient]]}>
 *     <MyComponent />
 *   </TestApiProvider>
 * );
 * ```
 */
export type MockOpenChoreoClient = Record<
  (typeof methodNames)[number],
  jest.Mock
>;

export function createMockOpenChoreoClient(
  overrides: Partial<Record<string, jest.Mock>> = {},
): MockOpenChoreoClient {
  const mock = {} as Record<string, jest.Mock>;
  for (const name of methodNames) {
    mock[name] = overrides[name] ?? jest.fn();
  }
  return mock as MockOpenChoreoClient;
}
