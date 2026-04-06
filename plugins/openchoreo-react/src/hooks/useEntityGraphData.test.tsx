import { renderHook, act } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity, RELATION_PART_OF, RELATION_HAS_PART } from '@backstage/catalog-model';
import {
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
} from '@openchoreo/backstage-plugin-common';
import { useEntityGraphData } from './useEntityGraphData';
import { APPLICATION_VIEW } from '../utils/platformOverviewConstants';

// ---- Mocks ----

const mockCatalogApi = {
  getEntitiesByRefs: jest.fn(),
};

// ---- Helpers ----

function makeEntity(
  kind: string,
  name: string,
  namespace: string,
  relations: { type: string; targetRef: string }[] = [],
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name, namespace },
    relations,
  } as Entity;
}

function ref(kind: string, ns: string, name: string) {
  return { kind, namespace: ns, name };
}

function refStr(kind: string, ns: string, name: string) {
  return `${kind.toLowerCase()}:${ns}/${name}`;
}

function renderWithApi<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <TestApiProvider apis={[[catalogApiRef, mockCatalogApi as any]]}>
        {children}
      </TestApiProvider>
    ),
  });
}

// ---- Test data ----

const projectRef = ref('system', 'default', 'my-project');
const componentRef = ref('component', 'default', 'nginx');
const pipelineRef = ref('deploymentpipeline', 'default', 'default-pipeline');
const envDevRef = ref('environment', 'default', 'development');
const envProdRef = ref('environment', 'default', 'production');

const projectEntity = makeEntity('system', 'my-project', 'default', [
  { type: RELATION_HAS_PART, targetRef: refStr('component', 'default', 'nginx') },
  { type: RELATION_USES_PIPELINE, targetRef: refStr('deploymentpipeline', 'default', 'default-pipeline') },
]);

const componentEntity = makeEntity('component', 'nginx', 'default', [
  { type: RELATION_PART_OF, targetRef: refStr('system', 'default', 'my-project') },
]);

const pipelineEntity = makeEntity('deploymentpipeline', 'default-pipeline', 'default', [
  { type: RELATION_PIPELINE_USED_BY, targetRef: refStr('system', 'default', 'my-project') },
  { type: RELATION_DEPLOYS_TO, targetRef: refStr('environment', 'default', 'development') },
  { type: RELATION_DEPLOYS_TO, targetRef: refStr('environment', 'default', 'production') },
]);

const envDevEntity = makeEntity('environment', 'development', 'default', [
  { type: RELATION_DEPLOYED_BY, targetRef: refStr('deploymentpipeline', 'default', 'default-pipeline') },
]);

const envProdEntity = makeEntity('environment', 'production', 'default', [
  { type: RELATION_DEPLOYED_BY, targetRef: refStr('deploymentpipeline', 'default', 'default-pipeline') },
]);

function setupFullGraph() {
  mockCatalogApi.getEntitiesByRefs.mockResolvedValue({
    items: [projectEntity, componentEntity, pipelineEntity, envDevEntity, envProdEntity],
  });
}

// ---- Tests ----

describe('useEntityGraphData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty graph for empty entity refs', async () => {
    const { result } = renderWithApi(() =>
      useEntityGraphData([], APPLICATION_VIEW),
    );

    await act(async () => {});

    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(mockCatalogApi.getEntitiesByRefs).not.toHaveBeenCalled();
  });

  it('builds nodes from fetched entities', async () => {
    setupFullGraph();

    const { result } = renderWithApi(() =>
      useEntityGraphData(
        [projectRef, componentRef, pipelineRef, envDevRef, envProdRef],
        APPLICATION_VIEW,
      ),
    );

    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.nodes).toHaveLength(5);
    expect(result.current.nodes.map(n => n.name).sort()).toEqual([
      'default-pipeline',
      'development',
      'my-project',
      'nginx',
      'production',
    ]);
  });

  it('builds edges from entity relations', async () => {
    setupFullGraph();

    const { result } = renderWithApi(() =>
      useEntityGraphData(
        [projectRef, componentRef, pipelineRef, envDevRef, envProdRef],
        APPLICATION_VIEW,
      ),
    );

    await act(async () => {});

    expect(result.current.edges.length).toBeGreaterThan(0);

    // Check partOf edge: component -> project
    const partOfEdge = result.current.edges.find(e =>
      e.relations.includes(RELATION_PART_OF),
    );
    expect(partOfEdge).toBeDefined();
    expect(partOfEdge!.from).toContain('nginx');
    expect(partOfEdge!.to).toContain('my-project');
  });

  it('normalizes edge direction using relation pairs', async () => {
    setupFullGraph();

    const { result } = renderWithApi(() =>
      useEntityGraphData(
        [projectRef, componentRef, pipelineRef, envDevRef, envProdRef],
        APPLICATION_VIEW,
      ),
    );

    await act(async () => {});

    // deploysTo edges: pipeline -> environment (forward direction)
    const deployEdges = result.current.edges.filter(e =>
      e.relations.includes(RELATION_DEPLOYS_TO),
    );
    expect(deployEdges.length).toBeGreaterThanOrEqual(2);
    for (const edge of deployEdges) {
      expect(edge.from).toContain('default-pipeline');
    }
  });

  it('deduplicates edges from bidirectional relations', async () => {
    setupFullGraph();

    const { result } = renderWithApi(() =>
      useEntityGraphData(
        [projectRef, componentRef, pipelineRef, envDevRef, envProdRef],
        APPLICATION_VIEW,
      ),
    );

    await act(async () => {});

    // Between pipeline and dev-env, both DEPLOYS_TO and DEPLOYED_BY exist
    // but should produce only one edge
    const pipelineToDevEdges = result.current.edges.filter(
      e =>
        e.from.includes('default-pipeline') &&
        e.to.includes('development'),
    );
    expect(pipelineToDevEdges).toHaveLength(1);
  });

  it('sets error on fetch failure', async () => {
    mockCatalogApi.getEntitiesByRefs.mockRejectedValue(
      new Error('Catalog unavailable'),
    );

    const { result } = renderWithApi(() =>
      useEntityGraphData([projectRef], APPLICATION_VIEW),
    );

    await act(async () => {});

    expect(result.current.error).toEqual(new Error('Catalog unavailable'));
    expect(result.current.loading).toBe(false);
  });

  it('skips null entities from API response', async () => {
    mockCatalogApi.getEntitiesByRefs.mockResolvedValue({
      items: [projectEntity, null],
    });

    const { result } = renderWithApi(() =>
      useEntityGraphData(
        [projectRef, componentRef],
        APPLICATION_VIEW,
      ),
    );

    await act(async () => {});

    expect(result.current.nodes).toHaveLength(1);
  });

  // ---- Project reachability filtering ----

  describe('project reachability filtering', () => {
    const projectARef = ref('system', 'default', 'project-a');
    const projectBRef = ref('system', 'default', 'project-b');
    const compARef = ref('component', 'default', 'comp-a');
    const compBRef = ref('component', 'default', 'comp-b');
    const sharedEnvRef = ref('environment', 'default', 'shared-env');

    const projectAEntity = makeEntity('system', 'project-a', 'default', [
      { type: RELATION_HAS_PART, targetRef: refStr('component', 'default', 'comp-a') },
      { type: RELATION_DEPLOYS_TO, targetRef: refStr('environment', 'default', 'shared-env') },
    ]);
    const projectBEntity = makeEntity('system', 'project-b', 'default', [
      { type: RELATION_HAS_PART, targetRef: refStr('component', 'default', 'comp-b') },
      { type: RELATION_DEPLOYS_TO, targetRef: refStr('environment', 'default', 'shared-env') },
    ]);
    const compAEntity = makeEntity('component', 'comp-a', 'default', [
      { type: RELATION_PART_OF, targetRef: refStr('system', 'default', 'project-a') },
    ]);
    const compBEntity = makeEntity('component', 'comp-b', 'default', [
      { type: RELATION_PART_OF, targetRef: refStr('system', 'default', 'project-b') },
    ]);
    const sharedEnvEntity = makeEntity('environment', 'shared-env', 'default', [
      { type: RELATION_DEPLOYED_BY, targetRef: refStr('system', 'default', 'project-a') },
      { type: RELATION_DEPLOYED_BY, targetRef: refStr('system', 'default', 'project-b') },
    ]);

    const allRefs = [projectARef, projectBRef, compARef, compBRef, sharedEnvRef];
    const allProjectRefStrs = [
      refStr('system', 'default', 'project-a'),
      refStr('system', 'default', 'project-b'),
    ];

    beforeEach(() => {
      mockCatalogApi.getEntitiesByRefs.mockResolvedValue({
        items: [projectAEntity, projectBEntity, compAEntity, compBEntity, sharedEnvEntity],
      });
    });

    it('shows all nodes when no project filter applied', async () => {
      const { result } = renderWithApi(() =>
        useEntityGraphData(allRefs, APPLICATION_VIEW),
      );

      await act(async () => {});

      expect(result.current.nodes).toHaveLength(5);
    });

    it('filters to only reachable nodes from selected project', async () => {
      const selectedProjects = [refStr('system', 'default', 'project-a')];

      const { result } = renderWithApi(() =>
        useEntityGraphData(
          allRefs,
          APPLICATION_VIEW,
          undefined,
          selectedProjects,
          allProjectRefStrs,
        ),
      );

      await act(async () => {});

      const nodeNames = result.current.nodes.map(n => n.name);
      expect(nodeNames).toContain('project-a');
      expect(nodeNames).toContain('comp-a');
      expect(nodeNames).toContain('shared-env');
      // project-b is excluded (deselected), comp-b is unreachable
      expect(nodeNames).not.toContain('project-b');
      expect(nodeNames).not.toContain('comp-b');
    });

    it('shows empty graph when all projects deselected', async () => {
      const { result } = renderWithApi(() =>
        useEntityGraphData(
          allRefs,
          APPLICATION_VIEW,
          undefined,
          [], // empty = all deselected
          allProjectRefStrs,
        ),
      );

      await act(async () => {});

      expect(result.current.nodes).toEqual([]);
      expect(result.current.edges).toEqual([]);
    });

    it('prevents shared entities from bridging deselected projects', async () => {
      // Select only project-a. shared-env is connected to both projects,
      // but BFS should NOT traverse through project-b to reach comp-b.
      const selectedProjects = [refStr('system', 'default', 'project-a')];

      const { result } = renderWithApi(() =>
        useEntityGraphData(
          allRefs,
          APPLICATION_VIEW,
          undefined,
          selectedProjects,
          allProjectRefStrs,
        ),
      );

      await act(async () => {});

      const nodeNames = result.current.nodes.map(n => n.name);
      expect(nodeNames).not.toContain('comp-b');
    });
  });
});
