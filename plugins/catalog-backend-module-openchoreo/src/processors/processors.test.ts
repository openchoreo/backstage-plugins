import { processingResult } from '@backstage/plugin-catalog-node';
import { RELATION_HAS_PART, RELATION_PART_OF } from '@backstage/catalog-model';
import {
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
  RELATION_INSTANCE_OF,
  RELATION_HAS_INSTANCE,
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
} from '@openchoreo/backstage-plugin-common';

import { ClusterComponentTypeEntityProcessor } from './ClusterComponentTypeEntityProcessor';
import { ClusterDataplaneEntityProcessor } from './ClusterDataplaneEntityProcessor';
import { ClusterObservabilityPlaneEntityProcessor } from './ClusterObservabilityPlaneEntityProcessor';
import { ClusterTraitTypeEntityProcessor } from './ClusterTraitTypeEntityProcessor';
import { ClusterWorkflowEntityProcessor } from './ClusterWorkflowEntityProcessor';
import { ClusterWorkflowPlaneEntityProcessor } from './ClusterWorkflowPlaneEntityProcessor';
import { ComponentEntityProcessor } from './ComponentEntityProcessor';
import { ComponentTypeEntityProcessor } from './ComponentTypeEntityProcessor';
import { ComponentWorkflowEntityProcessor } from './ComponentWorkflowEntityProcessor';
import { CustomAnnotationProcessor } from './CustomAnnotationProcessor';
import { DataplaneEntityProcessor } from './DataplaneEntityProcessor';
import { DeploymentPipelineEntityProcessor } from './DeploymentPipelineEntityProcessor';
import { EnvironmentEntityProcessor } from './EnvironmentEntityProcessor';
import { ObservabilityPlaneEntityProcessor } from './ObservabilityPlaneEntityProcessor';
import { TraitTypeEntityProcessor } from './TraitTypeEntityProcessor';
import { WorkflowEntityProcessor } from './WorkflowEntityProcessor';
import { WorkflowPlaneEntityProcessor } from './WorkflowPlaneEntityProcessor';

const mockLocation = { type: 'url', target: 'http://test' } as any;

// ---------------------------------------------------------------------------
// EnvironmentEntityProcessor
// ---------------------------------------------------------------------------
describe('EnvironmentEntityProcessor', () => {
  const processor = new EnvironmentEntityProcessor();

  describe('validateEntityKind', () => {
    it('returns true for Environment kind', async () => {
      expect(
        await processor.validateEntityKind({ kind: 'Environment' } as any),
      ).toBe(true);
    });
    it('returns false for other kinds', async () => {
      expect(
        await processor.validateEntityKind({ kind: 'Component' } as any),
      ).toBe(false);
    });
  });

  describe('preProcessEntity', () => {
    it('defaults isProduction to true when spec.type is production', async () => {
      const entity = {
        kind: 'Environment',
        metadata: { name: 'prod' },
        spec: { type: 'production' },
      } as any;
      const result = await processor.preProcessEntity(
        entity,
        mockLocation,
        jest.fn(),
      );
      expect(result.spec.isProduction).toBe(true);
    });

    it('defaults isProduction to false when spec.type is not production', async () => {
      const entity = {
        kind: 'Environment',
        metadata: { name: 'dev' },
        spec: { type: 'development' },
      } as any;
      const result = await processor.preProcessEntity(
        entity,
        mockLocation,
        jest.fn(),
      );
      expect(result.spec.isProduction).toBe(false);
    });
  });

  describe('postProcessEntity', () => {
    it('emits partOf/hasPart relations when spec.domain is set', async () => {
      const emit = jest.fn();
      const entity = {
        kind: 'Environment',
        metadata: { name: 'dev', namespace: 'my-ns' },
        spec: { type: 'development', domain: 'my-ns' },
      } as any;
      await processor.postProcessEntity(entity, mockLocation, emit);
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
          type: RELATION_PART_OF,
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
          target: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          type: RELATION_HAS_PART,
        }),
      );
    });

    it('emits hostedOn/hosts to DataPlane by default', async () => {
      const emit = jest.fn();
      const entity = {
        kind: 'Environment',
        metadata: { name: 'dev', namespace: 'my-ns' },
        spec: { type: 'development', dataPlaneRef: 'dp-1' },
      } as any;
      await processor.postProcessEntity(entity, mockLocation, emit);
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          target: { kind: 'dataplane', namespace: 'my-ns', name: 'dp-1' },
          type: RELATION_HOSTED_ON,
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: { kind: 'dataplane', namespace: 'my-ns', name: 'dp-1' },
          target: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          type: RELATION_HOSTS,
        }),
      );
    });

    it('emits hostedOn to ClusterDataPlane when annotation specifies ClusterDataPlane', async () => {
      const emit = jest.fn();
      const entity = {
        kind: 'Environment',
        metadata: {
          name: 'dev',
          namespace: 'my-ns',
          annotations: {
            'openchoreo.io/data-plane-ref-kind': 'ClusterDataPlane',
          },
        },
        spec: { type: 'development', dataPlaneRef: 'cdp-1' },
      } as any;
      await processor.postProcessEntity(entity, mockLocation, emit);
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          target: {
            kind: 'clusterdataplane',
            namespace: 'openchoreo-cluster',
            name: 'cdp-1',
          },
          type: RELATION_HOSTED_ON,
        }),
      );
    });
  });

  describe('processEntity', () => {
    it('emits entity for Environment kind', async () => {
      const emit = jest.fn();
      const entity = {
        kind: 'Environment',
        metadata: { name: 'dev' },
        spec: { type: 'development' },
      } as any;
      await processor.processEntity(entity, mockLocation, emit);
      expect(emit).toHaveBeenCalledWith(
        processingResult.entity(mockLocation, entity),
      );
    });

    it('skips entities of other kinds', async () => {
      const emit = jest.fn();
      await processor.processEntity(
        { kind: 'Component' } as any,
        mockLocation,
        emit,
      );
      expect(emit).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// ComponentEntityProcessor
// ---------------------------------------------------------------------------
describe('ComponentEntityProcessor', () => {
  const processor = new ComponentEntityProcessor();

  it('emits instanceOf/hasInstance to ComponentType when annotation is set', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Component',
      metadata: {
        name: 'my-comp',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/component-type': 'deployment/service',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'component', namespace: 'my-ns', name: 'my-comp' },
        target: { kind: 'componenttype', namespace: 'my-ns', name: 'service' },
        type: RELATION_INSTANCE_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'componenttype', namespace: 'my-ns', name: 'service' },
        target: { kind: 'component', namespace: 'my-ns', name: 'my-comp' },
        type: RELATION_HAS_INSTANCE,
      }),
    );
  });

  it('targets ClusterComponentType when component-type-kind annotation is set', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Component',
      metadata: {
        name: 'my-comp',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/component-type': 'cronjob/scheduled-task',
          'openchoreo.io/component-type-kind': 'ClusterComponentType',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'component', namespace: 'my-ns', name: 'my-comp' },
        target: {
          kind: 'clustercomponenttype',
          namespace: 'openchoreo-cluster',
          name: 'scheduled-task',
        },
        type: RELATION_INSTANCE_OF,
      }),
    );
  });

  it('skips non-Component entities and Components without the annotation', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      { kind: 'Environment', metadata: { name: 'x' } } as any,
      mockLocation,
      emit,
    );
    await processor.postProcessEntity(
      { kind: 'Component', metadata: { name: 'x' } } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ComponentTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ComponentTypeEntityProcessor', () => {
  const processor = new ComponentTypeEntityProcessor();

  describe('validateEntityKind', () => {
    it('returns true for ComponentType', async () => {
      expect(
        await processor.validateEntityKind({ kind: 'ComponentType' } as any),
      ).toBe(true);
    });
    it('returns false for other kinds', async () => {
      expect(
        await processor.validateEntityKind({ kind: 'Component' } as any),
      ).toBe(false);
    });
  });

  it('emits partOf domain relation', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ComponentType',
      metadata: { name: 'svc', namespace: 'my-ns' },
      spec: { domain: 'my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'componenttype', namespace: 'my-ns', name: 'svc' },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
  });

  it('emits usesWorkflow relation for each allowed workflow', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ComponentType',
      metadata: { name: 'svc', namespace: 'my-ns' },
      spec: { allowedWorkflows: ['build-wf'] },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'componenttype', namespace: 'my-ns', name: 'svc' },
        target: { kind: 'workflow', namespace: 'my-ns', name: 'build-wf' },
        type: RELATION_USES_WORKFLOW,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'workflow', namespace: 'my-ns', name: 'build-wf' },
        target: { kind: 'componenttype', namespace: 'my-ns', name: 'svc' },
        type: RELATION_WORKFLOW_USED_BY,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ClusterComponentTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterComponentTypeEntityProcessor', () => {
  const processor = new ClusterComponentTypeEntityProcessor();

  it('validateEntityKind returns true for ClusterComponentType, false otherwise', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterComponentType',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'ComponentType' } as any),
    ).toBe(false);
  });

  it('does not emit any domain relation (cluster-scoped)', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterComponentType',
      metadata: { name: 'svc', namespace: 'openchoreo-cluster' },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits usesWorkflow relation to ClusterWorkflow when allowedWorkflows is set', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterComponentType',
      metadata: { name: 'svc', namespace: 'openchoreo-cluster' },
      spec: { allowedWorkflows: ['cluster-build'] },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clustercomponenttype',
          namespace: 'openchoreo-cluster',
          name: 'svc',
        },
        target: {
          kind: 'clusterworkflow',
          namespace: 'openchoreo-cluster',
          name: 'cluster-build',
        },
        type: RELATION_USES_WORKFLOW,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ClusterDataplaneEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterDataplaneEntityProcessor', () => {
  const processor = new ClusterDataplaneEntityProcessor();

  it('validateEntityKind returns true for ClusterDataplane', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'ClusterDataplane' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'Dataplane' } as any),
    ).toBe(false);
  });

  it('emits observedBy/observes to ClusterObservabilityPlane', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterDataplane',
      metadata: { name: 'cdp', namespace: 'openchoreo-cluster' },
      spec: { observabilityPlaneRef: 'cop' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterdataplane',
          namespace: 'openchoreo-cluster',
          name: 'cdp',
        },
        target: {
          kind: 'clusterobservabilityplane',
          namespace: 'openchoreo-cluster',
          name: 'cop',
        },
        type: RELATION_OBSERVED_BY,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterobservabilityplane',
          namespace: 'openchoreo-cluster',
          name: 'cop',
        },
        target: {
          kind: 'clusterdataplane',
          namespace: 'openchoreo-cluster',
          name: 'cdp',
        },
        type: RELATION_OBSERVES,
      }),
    );
  });

  it('does not emit relations for non-ClusterDataplane entities', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      { kind: 'Dataplane', metadata: { name: 'x' } } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ClusterObservabilityPlaneEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterObservabilityPlaneEntityProcessor', () => {
  const processor = new ClusterObservabilityPlaneEntityProcessor();

  it('validateEntityKind returns true for ClusterObservabilityPlane', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterObservabilityPlane',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({
        kind: 'ObservabilityPlane',
      } as any),
    ).toBe(false);
  });

  it('postProcessEntity does not emit any relations', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterObservabilityPlane',
      metadata: { name: 'cop' },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).not.toHaveBeenCalled();
  });

  it('processEntity emits entity for ClusterObservabilityPlane', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterObservabilityPlane',
      metadata: { name: 'cop' },
      spec: {},
    } as any;
    await processor.processEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.entity(mockLocation, entity),
    );
  });
});

// ---------------------------------------------------------------------------
// ClusterTraitTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterTraitTypeEntityProcessor', () => {
  const processor = new ClusterTraitTypeEntityProcessor();

  it('validateEntityKind returns true for ClusterTraitType', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'ClusterTraitType' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'TraitType' } as any),
    ).toBe(false);
  });

  it('postProcessEntity emits no relations', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      { kind: 'ClusterTraitType', metadata: { name: 't' }, spec: {} } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ClusterWorkflowEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterWorkflowEntityProcessor', () => {
  const processor = new ClusterWorkflowEntityProcessor();

  it('validateEntityKind returns true for ClusterWorkflow', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'ClusterWorkflow' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'Workflow' } as any),
    ).toBe(false);
  });

  it('does not emit any domain relation (cluster-scoped)', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      {
        kind: 'ClusterWorkflow',
        metadata: { name: 'wf', namespace: 'openchoreo-cluster' },
        spec: {},
      } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('emits buildsOn/builds to ClusterWorkflowPlane from annotation', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterWorkflow',
      metadata: {
        name: 'wf',
        namespace: 'openchoreo-cluster',
        annotations: {
          'openchoreo.io/workflow-plane-ref': 'cwp-1',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterworkflow',
          namespace: 'openchoreo-cluster',
          name: 'wf',
        },
        target: {
          kind: 'clusterworkflowplane',
          namespace: 'openchoreo-cluster',
          name: 'cwp-1',
        },
        type: RELATION_BUILDS_ON,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterworkflowplane',
          namespace: 'openchoreo-cluster',
          name: 'cwp-1',
        },
        target: {
          kind: 'clusterworkflow',
          namespace: 'openchoreo-cluster',
          name: 'wf',
        },
        type: RELATION_BUILDS,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ClusterWorkflowPlaneEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterWorkflowPlaneEntityProcessor', () => {
  const processor = new ClusterWorkflowPlaneEntityProcessor();

  it('validateEntityKind returns true for ClusterWorkflowPlane', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterWorkflowPlane',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'WorkflowPlane' } as any),
    ).toBe(false);
  });

  it('emits observedBy/observes to ClusterObservabilityPlane', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterWorkflowPlane',
      metadata: { name: 'cwp', namespace: 'openchoreo-cluster' },
      spec: { observabilityPlaneRef: 'cop' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterworkflowplane',
          namespace: 'openchoreo-cluster',
          name: 'cwp',
        },
        target: {
          kind: 'clusterobservabilityplane',
          namespace: 'openchoreo-cluster',
          name: 'cop',
        },
        type: RELATION_OBSERVED_BY,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ComponentWorkflowEntityProcessor
// ---------------------------------------------------------------------------
describe('ComponentWorkflowEntityProcessor', () => {
  const processor = new ComponentWorkflowEntityProcessor();

  it('validateEntityKind returns true for ComponentWorkflow', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ComponentWorkflow',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'Workflow' } as any),
    ).toBe(false);
  });

  it('emits partOf/hasPart to domain', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ComponentWorkflow',
      metadata: { name: 'cwf', namespace: 'my-ns' },
      spec: { domain: 'my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'componentworkflow',
          namespace: 'my-ns',
          name: 'cwf',
        },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        target: {
          kind: 'componentworkflow',
          namespace: 'my-ns',
          name: 'cwf',
        },
        type: RELATION_HAS_PART,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// CustomAnnotationProcessor
// ---------------------------------------------------------------------------
describe('CustomAnnotationProcessor', () => {
  function createProcessor(annotations: Record<string, string> = {}): {
    processor: CustomAnnotationProcessor;
    getAnnotations: jest.Mock;
  } {
    const getAnnotations = jest.fn().mockResolvedValue(annotations);
    const store = {
      getAnnotations,
      setAnnotations: jest.fn(),
      deleteAllAnnotations: jest.fn(),
    };
    return {
      processor: new CustomAnnotationProcessor(store),
      getAnnotations,
    };
  }

  it('skips non-managed entities (no openchoreo.io/managed label)', async () => {
    const { processor, getAnnotations } = createProcessor({ foo: 'bar' });
    const entity = {
      kind: 'Component',
      metadata: { name: 'c', namespace: 'default', labels: {} },
    } as any;
    const result = await processor.preProcessEntity(entity, mockLocation);
    expect(getAnnotations).not.toHaveBeenCalled();
    expect(result).toBe(entity);
  });

  it('merges custom annotations into managed entities', async () => {
    const { processor, getAnnotations } = createProcessor({
      'custom.io/note': 'hello',
    });
    const entity = {
      kind: 'Component',
      metadata: {
        name: 'c',
        namespace: 'default',
        labels: { 'openchoreo.io/managed': 'true' },
        annotations: { 'existing/anno': 'keep' },
      },
    } as any;
    const result = await processor.preProcessEntity(entity, mockLocation);
    expect(getAnnotations).toHaveBeenCalledWith('component:default/c');
    expect(result.metadata.annotations).toEqual({
      'existing/anno': 'keep',
      'custom.io/note': 'hello',
    });
  });

  it('returns entity unchanged when AnnotationStore returns empty annotations', async () => {
    const { processor } = createProcessor({});
    const entity = {
      kind: 'Component',
      metadata: {
        name: 'c',
        namespace: 'default',
        labels: { 'openchoreo.io/managed': 'true' },
        annotations: { existing: 'a' },
      },
    } as any;
    const result = await processor.preProcessEntity(entity, mockLocation);
    expect(result).toBe(entity);
  });
});

// ---------------------------------------------------------------------------
// DataplaneEntityProcessor
// ---------------------------------------------------------------------------
describe('DataplaneEntityProcessor', () => {
  const processor = new DataplaneEntityProcessor();

  it('validateEntityKind returns true for Dataplane', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'Dataplane' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'ClusterDataplane' } as any),
    ).toBe(false);
  });

  it('emits partOf domain relation', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Dataplane',
      metadata: { name: 'dp', namespace: 'my-ns' },
      spec: { domain: 'my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'dataplane', namespace: 'my-ns', name: 'dp' },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
  });

  it('emits observedBy/observes to ObservabilityPlane', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Dataplane',
      metadata: { name: 'dp', namespace: 'my-ns' },
      spec: { observabilityPlaneRef: 'op' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'dataplane', namespace: 'my-ns', name: 'dp' },
        target: {
          kind: 'observabilityplane',
          namespace: 'my-ns',
          name: 'op',
        },
        type: RELATION_OBSERVED_BY,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'observabilityplane',
          namespace: 'my-ns',
          name: 'op',
        },
        target: { kind: 'dataplane', namespace: 'my-ns', name: 'dp' },
        type: RELATION_OBSERVES,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// DeploymentPipelineEntityProcessor
// ---------------------------------------------------------------------------
describe('DeploymentPipelineEntityProcessor', () => {
  const processor = new DeploymentPipelineEntityProcessor();

  it('validateEntityKind returns true for DeploymentPipeline', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'DeploymentPipeline',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'Component' } as any),
    ).toBe(false);
  });

  it('emits usesPipeline/pipelineUsedBy for projectRefs', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'DeploymentPipeline',
      metadata: { name: 'pipe', namespace: 'my-ns' },
      spec: {
        projectRefs: ['proj-1'],
        namespaceName: 'my-ns',
      },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'system', namespace: 'my-ns', name: 'proj-1' },
        target: {
          kind: 'deploymentpipeline',
          namespace: 'my-ns',
          name: 'pipe',
        },
        type: RELATION_USES_PIPELINE,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'deploymentpipeline',
          namespace: 'my-ns',
          name: 'pipe',
        },
        target: { kind: 'system', namespace: 'my-ns', name: 'proj-1' },
        type: RELATION_PIPELINE_USED_BY,
      }),
    );
  });

  it('emits deploysTo/deployedBy for environments in promotionPaths', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'DeploymentPipeline',
      metadata: { name: 'pipe', namespace: 'my-ns' },
      spec: {
        promotionPaths: [
          {
            sourceEnvironment: 'dev',
            targetEnvironments: [{ name: 'staging' }],
          },
        ],
      },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'deploymentpipeline',
          namespace: 'my-ns',
          name: 'pipe',
        },
        target: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
        type: RELATION_DEPLOYS_TO,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'environment', namespace: 'my-ns', name: 'staging' },
        target: {
          kind: 'deploymentpipeline',
          namespace: 'my-ns',
          name: 'pipe',
        },
        type: RELATION_DEPLOYED_BY,
      }),
    );
  });

  it('skips non-DeploymentPipeline entities', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      { kind: 'Component', metadata: { name: 'x' } } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ObservabilityPlaneEntityProcessor
// ---------------------------------------------------------------------------
describe('ObservabilityPlaneEntityProcessor', () => {
  const processor = new ObservabilityPlaneEntityProcessor();

  it('validateEntityKind returns true for ObservabilityPlane', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ObservabilityPlane',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterObservabilityPlane',
      } as any),
    ).toBe(false);
  });

  it('emits partOf/hasPart domain relation', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ObservabilityPlane',
      metadata: { name: 'op', namespace: 'my-ns' },
      spec: { domain: 'my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'observabilityplane',
          namespace: 'my-ns',
          name: 'op',
        },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// TraitTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('TraitTypeEntityProcessor', () => {
  const processor = new TraitTypeEntityProcessor();

  it('validateEntityKind returns true for TraitType', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'TraitType' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'ClusterTraitType' } as any),
    ).toBe(false);
  });

  it('emits partOf domain relation', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'TraitType',
      metadata: { name: 't', namespace: 'my-ns' },
      spec: { domain: 'my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'traittype', namespace: 'my-ns', name: 't' },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// WorkflowEntityProcessor
// ---------------------------------------------------------------------------
describe('WorkflowEntityProcessor', () => {
  const processor = new WorkflowEntityProcessor();

  it('validateEntityKind returns true for Workflow', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'Workflow' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'ClusterWorkflow' } as any),
    ).toBe(false);
  });

  it('emits partOf domain and buildsOn WorkflowPlane by default', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Workflow',
      metadata: {
        name: 'wf',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/workflow-plane-ref': 'wp-1',
        },
      },
      spec: { domain: 'my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'workflow', namespace: 'my-ns', name: 'wf' },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'workflow', namespace: 'my-ns', name: 'wf' },
        target: { kind: 'workflowplane', namespace: 'my-ns', name: 'wp-1' },
        type: RELATION_BUILDS_ON,
      }),
    );
  });

  it('emits buildsOn ClusterWorkflowPlane when workflow-plane-ref-kind is ClusterWorkflowPlane', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Workflow',
      metadata: {
        name: 'wf',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/workflow-plane-ref': 'cwp-1',
          'openchoreo.io/workflow-plane-ref-kind': 'ClusterWorkflowPlane',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'workflow', namespace: 'my-ns', name: 'wf' },
        target: {
          kind: 'clusterworkflowplane',
          namespace: 'openchoreo-cluster',
          name: 'cwp-1',
        },
        type: RELATION_BUILDS_ON,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// WorkflowPlaneEntityProcessor
// ---------------------------------------------------------------------------
describe('WorkflowPlaneEntityProcessor', () => {
  const processor = new WorkflowPlaneEntityProcessor();

  it('validateEntityKind returns true for WorkflowPlane', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'WorkflowPlane' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterWorkflowPlane',
      } as any),
    ).toBe(false);
  });

  it('emits partOf domain and observedBy ObservabilityPlane', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'WorkflowPlane',
      metadata: { name: 'wp', namespace: 'my-ns' },
      spec: { domain: 'my-ns', observabilityPlaneRef: 'op' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'workflowplane', namespace: 'my-ns', name: 'wp' },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'workflowplane', namespace: 'my-ns', name: 'wp' },
        target: {
          kind: 'observabilityplane',
          namespace: 'my-ns',
          name: 'op',
        },
        type: RELATION_OBSERVED_BY,
      }),
    );
  });
});
