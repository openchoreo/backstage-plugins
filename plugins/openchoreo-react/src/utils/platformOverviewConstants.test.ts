import {
  APPLICATION_VIEW,
  INFRASTRUCTURE_VIEW,
  CLUSTER_VIEW,
  ALL_VIEWS,
  CLUSTER_NAMESPACE,
  CLUSTER_SCOPED_KINDS,
  getFilterPresets,
  getEffectiveKinds,
  buildDynamicView,
  ALL_FILTERABLE_KINDS,
} from './platformOverviewConstants';

describe('platformOverviewConstants', () => {
  // ---- View definitions ----

  describe('view definitions', () => {
    it('APPLICATION_VIEW includes developer-facing kinds', () => {
      expect(APPLICATION_VIEW.kinds).toEqual(
        expect.arrayContaining([
          'system',
          'component',
          'deploymentpipeline',
          'environment',
        ]),
      );
    });

    it('INFRASTRUCTURE_VIEW includes platform kinds', () => {
      expect(INFRASTRUCTURE_VIEW.kinds).toEqual(
        expect.arrayContaining([
          'dataplane',
          'workflowplane',
          'observabilityplane',
          'environment',
        ]),
      );
    });

    it('CLUSTER_VIEW includes cluster-scoped kinds', () => {
      for (const kind of CLUSTER_SCOPED_KINDS) {
        expect(CLUSTER_VIEW.kinds).toContain(kind);
      }
    });

    it('ALL_VIEWS contains all three views', () => {
      expect(ALL_VIEWS).toHaveLength(3);
      expect(ALL_VIEWS.map(v => v.id)).toEqual([
        'developer',
        'platform',
        'cluster',
      ]);
    });

    it('each view has matching relation pairs for its relations', () => {
      for (const view of ALL_VIEWS) {
        const pairedRelations = view.relationPairs.flat();
        // Every relation in a pair should be in the relations list
        for (const rel of pairedRelations) {
          expect(view.relations).toContain(rel);
        }
      }
    });
  });

  // ---- CLUSTER_SCOPED_KINDS ----

  describe('CLUSTER_SCOPED_KINDS', () => {
    it('contains only cluster-prefixed kinds', () => {
      for (const kind of CLUSTER_SCOPED_KINDS) {
        expect(kind).toMatch(/^cluster/);
      }
    });

    it('CLUSTER_NAMESPACE is the expected value', () => {
      expect(CLUSTER_NAMESPACE).toBe('openchoreo-cluster');
    });
  });

  // ---- getFilterPresets ----

  describe('getFilterPresets', () => {
    it('returns 3 presets', () => {
      expect(getFilterPresets(true)).toHaveLength(3);
      expect(getFilterPresets(false)).toHaveLength(3);
    });

    it('Developer Resources preset always matches APPLICATION_VIEW kinds', () => {
      const devPreset = getFilterPresets(true).find(p => p.id === 'developer')!;
      expect(devPreset.kinds).toEqual(APPLICATION_VIEW.kinds);
    });

    it('All preset includes cluster kinds when cluster scope active', () => {
      const allPreset = getFilterPresets(true).find(p => p.id === 'all')!;
      for (const kind of CLUSTER_SCOPED_KINDS) {
        expect(allPreset.kinds).toContain(kind);
      }
    });

    it('All preset excludes cluster kinds when cluster scope inactive', () => {
      const allPreset = getFilterPresets(false).find(p => p.id === 'all')!;
      for (const kind of CLUSTER_SCOPED_KINDS) {
        expect(allPreset.kinds).not.toContain(kind);
      }
    });

    it('Platform Resources includes cluster kinds only when cluster scope active', () => {
      const withCluster = getFilterPresets(true).find(
        p => p.id === 'platform',
      )!;
      const withoutCluster = getFilterPresets(false).find(
        p => p.id === 'platform',
      )!;

      expect(withCluster.kinds).toEqual(
        expect.arrayContaining(CLUSTER_VIEW.kinds),
      );
      for (const kind of CLUSTER_SCOPED_KINDS) {
        expect(withoutCluster.kinds).not.toContain(kind);
      }
    });
  });

  // ---- getEffectiveKinds ----

  describe('getEffectiveKinds', () => {
    it('passes through all kinds when cluster scope active', () => {
      const kinds = ['system', 'component', 'clusterdataplane'];
      expect(getEffectiveKinds(kinds, true)).toEqual(kinds);
    });

    it('strips cluster-scoped kinds when cluster scope inactive', () => {
      const kinds = ['system', 'component', 'clusterdataplane', 'environment'];
      expect(getEffectiveKinds(kinds, false)).toEqual([
        'system',
        'component',
        'environment',
      ]);
    });

    it('returns empty array when all kinds are cluster-scoped and cluster scope is off', () => {
      expect(
        getEffectiveKinds(['clusterdataplane', 'clusterworkflow'], false),
      ).toEqual([]);
    });
  });

  // ---- buildDynamicView ----

  describe('buildDynamicView', () => {
    it('returns Developer Resources view for APPLICATION_VIEW kinds', () => {
      const view = buildDynamicView(APPLICATION_VIEW.kinds);
      expect(view.id).toBe('developer');
      expect(view.label).toBe('Developer Resources');
    });

    it('returns Platform Resources view for INFRASTRUCTURE_VIEW + CLUSTER_VIEW kinds', () => {
      const platformKinds = [
        ...INFRASTRUCTURE_VIEW.kinds,
        ...CLUSTER_VIEW.kinds,
      ];
      const view = buildDynamicView(platformKinds);
      expect(view.id).toBe('platform');
      expect(view.label).toBe('Platform Resources');
    });

    it('returns Custom View for arbitrary kind selection', () => {
      const view = buildDynamicView(['system', 'dataplane']);
      expect(view.id).toBe('custom');
      expect(view.label).toBe('Custom View');
    });

    it('merges relations from overlapping views', () => {
      // 'system' is in APPLICATION_VIEW, 'dataplane' is in INFRASTRUCTURE_VIEW
      const view = buildDynamicView(['system', 'dataplane']);
      // Should include relations from both views
      expect(view.relations.length).toBeGreaterThan(
        APPLICATION_VIEW.relations.length,
      );
    });

    it('builds description from kind labels', () => {
      const view = buildDynamicView(['system', 'environment']);
      expect(view.description).toContain('Project');
      expect(view.description).toContain('Environment');
    });

    it('returns "No entity kinds selected" when empty', () => {
      const view = buildDynamicView([]);
      expect(view.description).toBe('No entity kinds selected');
    });

    it('deduplicates relation pairs', () => {
      // environment appears in both APPLICATION_VIEW and INFRASTRUCTURE_VIEW
      const view = buildDynamicView([
        'system',
        'component',
        'environment',
        'dataplane',
      ]);
      const pairKeys = view.relationPairs.map(p => p.join('|'));
      const uniqueKeys = new Set(pairKeys);
      expect(pairKeys.length).toBe(uniqueKeys.size);
    });
  });

  // ---- ALL_FILTERABLE_KINDS ----

  describe('ALL_FILTERABLE_KINDS', () => {
    it('marks cluster-scoped kinds with clusterScoped flag', () => {
      const clusterKinds = ALL_FILTERABLE_KINDS.filter(k => k.clusterScoped);
      expect(clusterKinds.map(k => k.id)).toEqual(
        expect.arrayContaining(CLUSTER_SCOPED_KINDS),
      );
    });

    it('namespace-scoped kinds do not have clusterScoped flag', () => {
      const nsKinds = ALL_FILTERABLE_KINDS.filter(k => !k.clusterScoped);
      for (const kind of nsKinds) {
        expect(CLUSTER_SCOPED_KINDS).not.toContain(kind.id);
      }
    });
  });
});
