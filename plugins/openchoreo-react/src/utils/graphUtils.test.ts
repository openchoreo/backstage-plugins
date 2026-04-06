import {
  ENTITY_KIND_COLORS,
  DEFAULT_NODE_COLOR,
  ENTITY_KIND_TINTS,
  getNodeTintFill,
  getNodeColor,
  KIND_LABEL_PREFIXES,
  getNodeDisplayLabel,
  KIND_FULL_LABELS,
  getNodeKindLabel,
  isNodeMarkedForDeletion,
  DELETION_WARNING_COLOR,
  EDGE_COLOR,
} from './graphUtils';

describe('graphUtils', () => {
  // ---- getNodeColor ----

  describe('getNodeColor', () => {
    it('returns correct color for known kinds', () => {
      expect(getNodeColor('component')).toBe(ENTITY_KIND_COLORS.component);
      expect(getNodeColor('environment')).toBe(ENTITY_KIND_COLORS.environment);
      expect(getNodeColor('deploymentpipeline')).toBe(ENTITY_KIND_COLORS.deploymentpipeline);
      expect(getNodeColor('system')).toBe(ENTITY_KIND_COLORS.system);
    });

    it('is case-insensitive', () => {
      expect(getNodeColor('Component')).toBe(ENTITY_KIND_COLORS.component);
      expect(getNodeColor('ENVIRONMENT')).toBe(ENTITY_KIND_COLORS.environment);
    });

    it('returns default color for unknown kind', () => {
      expect(getNodeColor('unknownkind')).toBe(DEFAULT_NODE_COLOR);
    });

    it('returns default color for undefined', () => {
      expect(getNodeColor(undefined)).toBe(DEFAULT_NODE_COLOR);
    });
  });

  // ---- getNodeTintFill ----

  describe('getNodeTintFill', () => {
    const environmentColor = ENTITY_KIND_COLORS.environment;

    it('returns light tint for known accent', () => {
      expect(getNodeTintFill(environmentColor, false)).toBe(ENTITY_KIND_TINTS[environmentColor].light);
    });

    it('returns dark tint for known accent', () => {
      expect(getNodeTintFill(environmentColor, true)).toBe(ENTITY_KIND_TINTS[environmentColor].dark);
    });

    it('returns default tint for unknown accent', () => {
      // DEFAULT_TINT is not exported, so we verify the fallback values directly
      expect(getNodeTintFill('#ff0000', false)).toBe('#f3f4f6');
      expect(getNodeTintFill('#ff0000', true)).toBe('#1f2128');
    });
  });

  // ---- getNodeDisplayLabel ----

  describe('getNodeDisplayLabel', () => {
    it('adds prefix for known kinds', () => {
      expect(getNodeDisplayLabel('system', 'MyProject')).toBe(
        'Project: MyProject',
      );
      expect(getNodeDisplayLabel('component', 'Nginx')).toBe('Comp: Nginx');
      expect(getNodeDisplayLabel('deploymentpipeline', 'Default')).toBe(
        'Pipeline: Default',
      );
    });

    it('returns name without prefix for unknown kind', () => {
      expect(getNodeDisplayLabel('user', 'Alice')).toBe('Alice');
    });

    it('returns name when kind is undefined', () => {
      expect(getNodeDisplayLabel(undefined, 'SomeName')).toBe('SomeName');
    });
  });

  // ---- getNodeKindLabel ----

  describe('getNodeKindLabel', () => {
    it('returns full label for known kinds', () => {
      expect(getNodeKindLabel('system')).toBe('Project');
      expect(getNodeKindLabel('environment')).toBe('Environment');
      expect(getNodeKindLabel('deploymentpipeline')).toBe('Pipeline');
      expect(getNodeKindLabel('clusterdataplane')).toBe('Cluster Data Plane');
    });

    it('is case-insensitive', () => {
      expect(getNodeKindLabel('System')).toBe('Project');
    });

    it('returns undefined for unknown kind', () => {
      expect(getNodeKindLabel('unknownkind')).toBeUndefined();
    });

    it('returns undefined when kind is undefined', () => {
      expect(getNodeKindLabel(undefined)).toBeUndefined();
    });
  });

  // ---- isNodeMarkedForDeletion ----

  describe('isNodeMarkedForDeletion', () => {
    it('returns true when deletion timestamp annotation exists', () => {
      const entity = {
        metadata: {
          annotations: {
            'openchoreo.io/deletion-timestamp': '2024-01-01T00:00:00Z',
          },
        },
      };
      expect(isNodeMarkedForDeletion(entity)).toBe(true);
    });

    it('returns false when annotation is missing', () => {
      const entity = {
        metadata: { annotations: {} },
      };
      expect(isNodeMarkedForDeletion(entity)).toBe(false);
    });

    it('returns false when annotations object is undefined', () => {
      const entity = {
        metadata: {},
      };
      expect(isNodeMarkedForDeletion(entity)).toBe(false);
    });
  });

  // ---- Constants sanity checks ----

  describe('constants', () => {
    it('ENTITY_KIND_COLORS covers all OpenChoreo custom kinds', () => {
      const customKinds = [
        'environment',
        'dataplane',
        'deploymentpipeline',
        'workflowplane',
        'observabilityplane',
        'componenttype',
        'traittype',
        'clustercomponenttype',
        'clustertraittype',
        'clusterdataplane',
        'clusterworkflowplane',
        'clusterobservabilityplane',
        'workflow',
        'clusterworkflow',
        'componentworkflow',
      ];
      for (const kind of customKinds) {
        expect(ENTITY_KIND_COLORS[kind]).toBeDefined();
      }
    });

    it('ENTITY_KIND_TINTS has an entry for each unique color in ENTITY_KIND_COLORS', () => {
      const uniqueColors = new Set(Object.values(ENTITY_KIND_COLORS));
      for (const color of uniqueColors) {
        expect(ENTITY_KIND_TINTS[color]).toBeDefined();
      }
    });

    it('KIND_LABEL_PREFIXES and KIND_FULL_LABELS cover the same keys', () => {
      const prefixKeys = Object.keys(KIND_LABEL_PREFIXES).sort();
      const fullKeys = Object.keys(KIND_FULL_LABELS).sort();
      expect(prefixKeys).toEqual(fullKeys);
    });

    it('EDGE_COLOR and DELETION_WARNING_COLOR are valid hex strings', () => {
      expect(EDGE_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
      expect(DELETION_WARNING_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
