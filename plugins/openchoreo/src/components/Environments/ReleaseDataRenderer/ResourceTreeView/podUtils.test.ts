import { getPodContainerNames, treeHasPodNode } from './podUtils';
import type { ResourceTreeData } from '../types';

describe('getPodContainerNames', () => {
  it('returns only regular containers, excluding init containers', () => {
    const specObject = {
      spec: {
        initContainers: [{ name: 'init' }],
        containers: [{ name: 'main' }, { name: 'sidecar' }],
      },
    };
    expect(getPodContainerNames(specObject)).toEqual(['main', 'sidecar']);
  });

  it('returns regular containers when there are no init containers', () => {
    const specObject = { spec: { containers: [{ name: 'main' }] } };
    expect(getPodContainerNames(specObject)).toEqual(['main']);
  });

  it('returns an empty array when specObject is undefined', () => {
    expect(getPodContainerNames(undefined)).toEqual([]);
  });

  it('returns an empty array when there is no spec', () => {
    expect(getPodContainerNames({})).toEqual([]);
  });

  it('ignores container entries without a string name', () => {
    const specObject = {
      spec: { containers: [{ image: 'x' }, { name: 'main' }, { name: 42 }] },
    };
    expect(getPodContainerNames(specObject as any)).toEqual(['main']);
  });
});

describe('treeHasPodNode', () => {
  const treeWith = (kinds: string[]): ResourceTreeData => ({
    renderedReleases: [
      {
        name: 'r',
        targetPlane: 'dataplane',
        nodes: kinds.map(kind => ({ kind })) as any,
      },
    ],
  });

  it('is true when a rendered release contains a Pod node', () => {
    expect(treeHasPodNode(treeWith(['Deployment', 'Pod']))).toBe(true);
  });

  it('is false when no rendered release contains a Pod node', () => {
    expect(treeHasPodNode(treeWith(['Deployment', 'Service']))).toBe(false);
  });

  it('is false for undefined / empty tree data', () => {
    expect(treeHasPodNode(undefined)).toBe(false);
    expect(treeHasPodNode({ renderedReleases: [] })).toBe(false);
  });

  it('is true when the layout nodes list contains a Pod node', () => {
    expect(treeHasPodNode(undefined, [{ kind: 'Pod' } as any])).toBe(true);
  });
});
