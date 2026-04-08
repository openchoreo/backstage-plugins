// Polyfill structuredClone for jsdom (used by dagre internally)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(val: T): T =>
    JSON.parse(JSON.stringify(val));
}

import {
  getResourceTreeNodes,
  buildTreeNodes,
  computeTreeLayout,
  NODE_WIDTH,
  NODE_HEIGHT,
} from './treeLayoutUtils';
import type { ResourceTreeData, ResourceTreeNode } from '../types';

// ---- Helpers ----

function makeNode(
  overrides: Partial<ResourceTreeNode> & {
    uid: string;
    kind: string;
    name: string;
  },
): ResourceTreeNode {
  return {
    version: 'v1',
    namespace: 'default',
    resourceVersion: '1',
    createdAt: '2026-01-01T00:00:00Z',
    object: {},
    health: { status: 'Healthy' },
    ...overrides,
  };
}

// ---- Tests ----

describe('getResourceTreeNodes', () => {
  it('returns empty array for undefined data', () => {
    expect(getResourceTreeNodes(undefined)).toEqual([]);
    expect(getResourceTreeNodes(null)).toEqual([]);
  });

  it('returns empty array when no renderedReleases', () => {
    expect(getResourceTreeNodes({})).toEqual([]);
  });

  it('flattens nodes from multiple releases', () => {
    const data: ResourceTreeData = {
      renderedReleases: [
        {
          name: 'release-a',
          targetPlane: 'dp',
          nodes: [makeNode({ uid: '1', kind: 'Deployment', name: 'dep-a' })],
        },
        {
          name: 'release-b',
          targetPlane: 'dp',
          nodes: [
            makeNode({ uid: '2', kind: 'Service', name: 'svc-b' }),
            makeNode({ uid: '3', kind: 'Pod', name: 'pod-b' }),
          ],
        },
      ],
    };

    const result = getResourceTreeNodes(data);
    expect(result).toHaveLength(3);
    expect(result.map(n => n.uid)).toEqual(['1', '2', '3']);
  });
});

describe('buildTreeNodes', () => {
  const singleReleaseData: ResourceTreeData = {
    renderedReleases: [
      {
        name: 'my-release',
        targetPlane: 'dataplane',
        nodes: [
          makeNode({ uid: 'dep-1', kind: 'Deployment', name: 'nginx' }),
          makeNode({
            uid: 'svc-1',
            kind: 'Service',
            name: 'nginx-svc',
            parentRefs: [
              {
                uid: 'dep-1',
                kind: 'Deployment',
                name: 'nginx',
                version: 'v1',
                namespace: 'default',
              },
            ],
          }),
        ],
      },
    ],
  };

  it('creates a root ReleaseBinding node', () => {
    const nodes = buildTreeNodes(singleReleaseData);
    const root = nodes.find(n => n.isRoot);

    expect(root).toBeDefined();
    expect(root!.kind).toBe('ReleaseBinding');
    expect(root!.parentIds).toEqual([]);
  });

  it('creates intermediate RenderedRelease nodes per release', () => {
    const nodes = buildTreeNodes(singleReleaseData);
    const releaseNodes = nodes.filter(n => n.kind === 'RenderedRelease');

    expect(releaseNodes).toHaveLength(1);
    expect(releaseNodes[0].name).toBe('my-release');
    expect(releaseNodes[0].version).toBe('dataplane');
  });

  it('links RenderedRelease nodes to root', () => {
    const nodes = buildTreeNodes(singleReleaseData);
    const releaseNode = nodes.find(n => n.kind === 'RenderedRelease')!;

    expect(releaseNode.parentIds).toEqual(['__release_binding__']);
  });

  it('links resource nodes to release node when no parentRefs', () => {
    const data: ResourceTreeData = {
      renderedReleases: [
        {
          name: 'rel',
          targetPlane: 'dp',
          nodes: [makeNode({ uid: 'np-1', kind: 'NetworkPolicy', name: 'np' })],
        },
      ],
    };
    const nodes = buildTreeNodes(data);
    const npNode = nodes.find(n => n.kind === 'NetworkPolicy')!;

    expect(npNode.parentIds).toEqual(['__release__rel']);
  });

  it('links resource nodes to parentRefs when provided', () => {
    const nodes = buildTreeNodes(singleReleaseData);
    const svcNode = nodes.find(n => n.kind === 'Service')!;

    expect(svcNode.parentIds).toEqual(['dep-1']);
  });

  it('preserves resource node metadata', () => {
    const nodes = buildTreeNodes(singleReleaseData);
    const depNode = nodes.find(n => n.kind === 'Deployment')!;

    expect(depNode.uid).toBe('dep-1');
    expect(depNode.name).toBe('nginx');
    expect(depNode.namespace).toBe('default');
    expect(depNode.healthStatus).toBe('Healthy');
  });

  // ---- Root health derivation ----

  describe('root health from legacy binding data', () => {
    it('sets Healthy when status is Ready', () => {
      const nodes = buildTreeNodes(singleReleaseData, { status: 'Ready' });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Healthy');
    });

    it('sets Degraded when status is Failed', () => {
      const nodes = buildTreeNodes(singleReleaseData, { status: 'Failed' });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Degraded');
    });

    it('sets Progressing when status is NotReady', () => {
      const nodes = buildTreeNodes(singleReleaseData, { status: 'NotReady' });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Progressing');
    });

    it('sets Undeployed when NotReady with ResourcesUndeployed reason', () => {
      const nodes = buildTreeNodes(singleReleaseData, {
        status: 'NotReady',
        statusReason: 'ResourcesUndeployed',
      });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Undeployed');
    });

    it('uses binding name for root node name', () => {
      const nodes = buildTreeNodes(singleReleaseData, {
        name: 'nginx-development',
        status: 'Ready',
      });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.name).toBe('nginx-development');
    });
  });

  describe('root health from new API binding data', () => {
    it('sets Healthy when Ready condition status is True', () => {
      const nodes = buildTreeNodes(singleReleaseData, {
        metadata: { name: 'my-binding' },
        status: {
          conditions: [{ type: 'Ready', status: 'True' }],
        },
      });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Healthy');
      expect(root.name).toBe('my-binding');
    });

    it('sets Degraded when Ready condition status is False', () => {
      const nodes = buildTreeNodes(singleReleaseData, {
        metadata: { name: 'my-binding' },
        status: {
          conditions: [{ type: 'Ready', status: 'False' }],
        },
      });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Degraded');
    });

    it('sets Undeployed when False with ResourcesUndeployed reason', () => {
      const nodes = buildTreeNodes(singleReleaseData, {
        metadata: { name: 'my-binding' },
        status: {
          conditions: [
            { type: 'Ready', status: 'False', reason: 'ResourcesUndeployed' },
          ],
        },
      });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Undeployed');
    });

    it('sets Progressing when Ready condition status is neither True nor False', () => {
      const nodes = buildTreeNodes(singleReleaseData, {
        metadata: { name: 'my-binding' },
        status: {
          conditions: [{ type: 'Ready', status: 'Unknown' }],
        },
      });
      const root = nodes.find(n => n.isRoot)!;
      expect(root.healthStatus).toBe('Progressing');
    });
  });

  it('defaults root health to Unknown when no binding data', () => {
    const nodes = buildTreeNodes(singleReleaseData);
    const root = nodes.find(n => n.isRoot)!;
    expect(root.healthStatus).toBe('Unknown');
  });

  // ---- Aggregated health for release nodes ----

  it('aggregates child health — Degraded wins over all', () => {
    const data: ResourceTreeData = {
      renderedReleases: [
        {
          name: 'rel',
          targetPlane: 'dp',
          nodes: [
            makeNode({
              uid: '1',
              kind: 'A',
              name: 'a',
              health: { status: 'Healthy' },
            }),
            makeNode({
              uid: '2',
              kind: 'B',
              name: 'b',
              health: { status: 'Degraded' },
            }),
            makeNode({
              uid: '3',
              kind: 'C',
              name: 'c',
              health: { status: 'Progressing' },
            }),
          ],
        },
      ],
    };
    const nodes = buildTreeNodes(data);
    const releaseNode = nodes.find(n => n.kind === 'RenderedRelease')!;
    expect(releaseNode.healthStatus).toBe('Degraded');
  });

  it('aggregates child health — Unknown > Suspended > Progressing', () => {
    const data: ResourceTreeData = {
      renderedReleases: [
        {
          name: 'rel',
          targetPlane: 'dp',
          nodes: [
            makeNode({
              uid: '1',
              kind: 'A',
              name: 'a',
              health: { status: 'Progressing' },
            }),
            makeNode({
              uid: '2',
              kind: 'B',
              name: 'b',
              health: { status: 'Unknown' },
            }),
            makeNode({
              uid: '3',
              kind: 'C',
              name: 'c',
              health: { status: 'Suspended' },
            }),
          ],
        },
      ],
    };
    const nodes = buildTreeNodes(data);
    const releaseNode = nodes.find(n => n.kind === 'RenderedRelease')!;
    expect(releaseNode.healthStatus).toBe('Unknown');
  });

  it('aggregates child health — all Healthy returns Healthy', () => {
    const data: ResourceTreeData = {
      renderedReleases: [
        {
          name: 'rel',
          targetPlane: 'dp',
          nodes: [
            makeNode({
              uid: '1',
              kind: 'A',
              name: 'a',
              health: { status: 'Healthy' },
            }),
            makeNode({
              uid: '2',
              kind: 'B',
              name: 'b',
              health: { status: 'Healthy' },
            }),
          ],
        },
      ],
    };
    const nodes = buildTreeNodes(data);
    const releaseNode = nodes.find(n => n.kind === 'RenderedRelease')!;
    expect(releaseNode.healthStatus).toBe('Healthy');
  });
});

describe('computeTreeLayout', () => {
  it('returns empty layout for empty nodes', () => {
    const layout = computeTreeLayout([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  it('positions a single node', () => {
    const layout = computeTreeLayout([
      {
        id: 'root',
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
        parentIds: [],
      },
    ]);

    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0].width).toBe(NODE_WIDTH);
    expect(layout.nodes[0].height).toBe(NODE_HEIGHT);
    expect(layout.edges).toEqual([]);
  });

  it('creates edges between parent and child nodes', () => {
    const layout = computeTreeLayout([
      {
        id: 'root',
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
        parentIds: [],
      },
      { id: 'child', kind: 'RenderedRelease', name: 'rr', parentIds: ['root'] },
    ]);

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0].from).toBe('root');
    expect(layout.edges[0].to).toBe('child');
    expect(layout.edges[0].lines.length).toBeGreaterThan(0);
  });

  it('lays out nodes left-to-right (root has smaller x)', () => {
    const layout = computeTreeLayout([
      {
        id: 'root',
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
        parentIds: [],
      },
      { id: 'child', kind: 'Deployment', name: 'dep', parentIds: ['root'] },
    ]);

    const root = layout.nodes.find(n => n.id === 'root')!;
    const child = layout.nodes.find(n => n.id === 'child')!;
    expect(root.x).toBeLessThan(child.x);
  });

  it('computes graph dimensions from node positions', () => {
    const layout = computeTreeLayout([
      {
        id: 'root',
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
        parentIds: [],
      },
      { id: 'child', kind: 'Deployment', name: 'dep', parentIds: ['root'] },
    ]);

    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    // Width should accommodate at least 2 nodes side by side
    expect(layout.width).toBeGreaterThan(NODE_WIDTH);
  });

  it('handles multi-level tree with correct edge count', () => {
    const layout = computeTreeLayout([
      {
        id: 'root',
        kind: 'ReleaseBinding',
        name: 'rb',
        isRoot: true,
        parentIds: [],
      },
      { id: 'rr', kind: 'RenderedRelease', name: 'rr', parentIds: ['root'] },
      { id: 'dep', kind: 'Deployment', name: 'dep', parentIds: ['rr'] },
      { id: 'svc', kind: 'Service', name: 'svc', parentIds: ['rr'] },
      { id: 'pod', kind: 'Pod', name: 'pod', parentIds: ['dep'] },
    ]);

    // Edges: root→rr, rr→dep, rr→svc, dep→pod = 4 edges
    expect(layout.edges).toHaveLength(4);
    expect(layout.nodes).toHaveLength(5);
  });
});
