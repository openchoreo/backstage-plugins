import {
  filterSecretReferencesForEnvDataPlane,
  type SecretReference,
} from './useSecretReferences';

function makeRef(
  name: string,
  targetPlane?: SecretReference['targetPlane'],
): SecretReference {
  return {
    name,
    namespace: 'ns',
    targetPlane,
    createdAt: '2025-01-01T00:00:00Z',
    status: 'Ready',
  };
}

describe('filterSecretReferencesForEnvDataPlane', () => {
  const dpProd = { kind: 'DataPlane', name: 'dp-prod' };
  const dpDev = { kind: 'DataPlane', name: 'dp-dev' };

  it('keeps refs without targetPlane (legacy / unscoped)', () => {
    const refs = [makeRef('legacy')];
    expect(filterSecretReferencesForEnvDataPlane(refs, dpProd)).toEqual(refs);
  });

  it('keeps refs whose targetPlane matches the env by both kind and name', () => {
    const ref = makeRef('match', dpProd);
    expect(filterSecretReferencesForEnvDataPlane([ref], dpProd)).toEqual([ref]);
  });

  it('drops refs whose targetPlane name differs', () => {
    const ref = makeRef('other-dp', dpDev);
    expect(filterSecretReferencesForEnvDataPlane([ref], dpProd)).toEqual([]);
  });

  it('drops refs whose targetPlane kind differs (e.g. WorkflowPlane)', () => {
    const wp = { kind: 'WorkflowPlane', name: 'dp-prod' };
    const ref = makeRef('wp-by-name', wp);
    expect(filterSecretReferencesForEnvDataPlane([ref], dpProd)).toEqual([]);
  });

  it('drops refs whose targetPlane kind is ClusterDataPlane when env is DataPlane', () => {
    const cdp = { kind: 'ClusterDataPlane', name: 'dp-prod' };
    const ref = makeRef('cdp', cdp);
    expect(filterSecretReferencesForEnvDataPlane([ref], dpProd)).toEqual([]);
  });

  it('keeps unscoped refs but drops scoped refs when env data plane is missing', () => {
    const legacy = makeRef('legacy');
    const scoped = makeRef('scoped', dpProd);
    expect(
      filterSecretReferencesForEnvDataPlane([legacy, scoped], undefined),
    ).toEqual([legacy]);
  });

  it('drops scoped refs when env data plane has only name (kind missing)', () => {
    const legacy = makeRef('legacy');
    const scoped = makeRef('scoped', dpProd);
    expect(
      filterSecretReferencesForEnvDataPlane([legacy, scoped], {
        name: 'dp-prod',
      }),
    ).toEqual([legacy]);
  });

  it('mixed input — keeps unscoped + matching, drops mismatches', () => {
    const refs = [
      makeRef('legacy'),
      makeRef('match', dpProd),
      makeRef('other-name', dpDev),
      makeRef('other-kind', { kind: 'ClusterDataPlane', name: 'dp-prod' }),
    ];
    const out = filterSecretReferencesForEnvDataPlane(refs, dpProd);
    expect(out.map(r => r.name)).toEqual(['legacy', 'match']);
  });
});
