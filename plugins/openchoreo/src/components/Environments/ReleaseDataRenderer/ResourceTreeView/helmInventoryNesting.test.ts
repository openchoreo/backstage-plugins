import {
  nestHelmReleaseChildren,
  parseFluxHelmInventoryEntryId,
} from './helmInventoryNesting';

describe('helmInventoryNesting', () => {
  it('parses Deployment and PVC inventory ids', () => {
    expect(parseFluxHelmInventoryEntryId('obt-dev_smollm2_apps_Deployment')).toEqual({
      namespace: 'obt-dev',
      name: 'smollm2',
      kind: 'Deployment',
      group: 'apps',
    });
    expect(
      parseFluxHelmInventoryEntryId(
        'obt-dev_smollm2-model-storage__PersistentVolumeClaim',
      ),
    ).toEqual({
      namespace: 'obt-dev',
      name: 'smollm2-model-storage',
      kind: 'PersistentVolumeClaim',
    });
  });

  it('reparents inventory Deployment under HelmRelease', () => {
    const nodes = [
      {
        id: 'hr-1',
        kind: 'HelmRelease',
        name: 'smollm2',
        namespace: 'obt-dev',
        parentIds: ['__release__rel'],
        specObject: {
          status: {
            inventory: {
              entries: [{ id: 'obt-dev_smollm2_apps_Deployment' }],
            },
          },
        },
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      {
        id: 'dep-1',
        kind: 'Deployment',
        name: 'smollm2',
        namespace: 'obt-dev',
        parentIds: ['__release__rel'],
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    ];

    nestHelmReleaseChildren(nodes as any, '__release__rel');
    expect(nodes[1].parentIds).toEqual(['hr-1']);
  });
});
