import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';
import {
  getNodeColor,
  getNodeTintFill,
  getEntityKindPalette,
  getDefaultNodeColor,
  getEdgeColor,
  getDeletionWarningColor,
  getNodeDisplayLabel,
  getNodeKindLabel,
  isNodeMarkedForDeletion,
  KIND_LABEL_PREFIXES,
  KIND_FULL_LABELS,
} from './graphUtils';

describe('graphUtils', () => {
  // ---- getNodeColor ----

  describe('getNodeColor', () => {
    it('returns correct color for known kinds', () => {
      expect(getNodeColor('component', lightTokens)).toBe(
        lightTokens.entityKind.component.accent,
      );
      expect(getNodeColor('environment', lightTokens)).toBe(
        lightTokens.entityKind.environment.accent,
      );
      expect(getNodeColor('deploymentpipeline', lightTokens)).toBe(
        lightTokens.entityKind.deploymentpipeline.accent,
      );
      expect(getNodeColor('system', lightTokens)).toBe(
        lightTokens.entityKind.system.accent,
      );
    });

    it('is case-insensitive', () => {
      expect(getNodeColor('Component', lightTokens)).toBe(
        lightTokens.entityKind.component.accent,
      );
      expect(getNodeColor('ENVIRONMENT', lightTokens)).toBe(
        lightTokens.entityKind.environment.accent,
      );
    });

    it('returns default color for unknown kind', () => {
      expect(getNodeColor('unknownkind', lightTokens)).toBe(
        lightTokens.entityKindDefault.accent,
      );
    });

    it('returns default color for undefined', () => {
      expect(getNodeColor(undefined, lightTokens)).toBe(
        lightTokens.entityKindDefault.accent,
      );
    });

    it('returns different accents across light and dark tokens', () => {
      // Tokens drive the palette — the same kind resolves to a different hex
      // in dark mode by construction.
      const lightAccent = getNodeColor('environment', lightTokens);
      const darkAccent = getNodeColor('environment', darkTokens);
      expect(lightAccent).not.toBe(darkAccent);
    });
  });

  // ---- getNodeTintFill ----

  describe('getNodeTintFill', () => {
    it('returns light tint for light tokens', () => {
      expect(getNodeTintFill('environment', lightTokens)).toBe(
        lightTokens.entityKind.environment.tint,
      );
    });

    it('returns dark tint for dark tokens', () => {
      expect(getNodeTintFill('environment', darkTokens)).toBe(
        darkTokens.entityKind.environment.tint,
      );
    });

    it('falls back to entityKindDefault for unknown kind', () => {
      expect(getNodeTintFill('unknownkind', lightTokens)).toBe(
        lightTokens.entityKindDefault.tint,
      );
      expect(getNodeTintFill('unknownkind', darkTokens)).toBe(
        darkTokens.entityKindDefault.tint,
      );
    });
  });

  // ---- getEntityKindPalette ----

  describe('getEntityKindPalette', () => {
    it('returns accent and tint together', () => {
      const palette = getEntityKindPalette('environment', lightTokens);
      expect(palette.accent).toBe(lightTokens.entityKind.environment.accent);
      expect(palette.tint).toBe(lightTokens.entityKind.environment.tint);
    });
  });

  // ---- defaults ----

  describe('defaults', () => {
    it('getDefaultNodeColor reads from tokens', () => {
      expect(getDefaultNodeColor(lightTokens)).toBe(
        lightTokens.entityKindDefault.accent,
      );
    });

    it('getEdgeColor reads from tokens', () => {
      expect(getEdgeColor(lightTokens)).toBe(lightTokens.graph.edge);
      expect(getEdgeColor(darkTokens)).toBe(darkTokens.graph.edge);
    });

    it('getDeletionWarningColor reads from tokens', () => {
      expect(getDeletionWarningColor(lightTokens)).toBe(
        lightTokens.deletionWarning,
      );
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
    it('tokens define palette for all OpenChoreo custom kinds', () => {
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
        expect(lightTokens.entityKind[kind]).toBeDefined();
        expect(darkTokens.entityKind[kind]).toBeDefined();
      }
    });

    it('KIND_LABEL_PREFIXES and KIND_FULL_LABELS cover the same keys', () => {
      const prefixKeys = Object.keys(KIND_LABEL_PREFIXES).sort();
      const fullKeys = Object.keys(KIND_FULL_LABELS).sort();
      expect(prefixKeys).toEqual(fullKeys);
    });

    it('edge and deletion colors are valid hex strings in both themes', () => {
      const hex = /^#[0-9a-f]{6}$/i;
      expect(getEdgeColor(lightTokens)).toMatch(hex);
      expect(getEdgeColor(darkTokens)).toMatch(hex);
      expect(getDeletionWarningColor(lightTokens)).toMatch(hex);
      expect(getDeletionWarningColor(darkTokens)).toMatch(hex);
    });
  });
});
