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
  RELATION_NOTIFIES,
  RELATION_NOTIFIED_BY,
} from '@openchoreo/backstage-plugin-common';

import { ClusterComponentTypeEntityProcessor } from './ClusterComponentTypeEntityProcessor';
import { ClusterResourceTypeEntityProcessor } from './ClusterResourceTypeEntityProcessor';
import { ResourceTypeEntityProcessor } from './ResourceTypeEntityProcessor';
import { ClusterProjectTypeEntityProcessor } from './ClusterProjectTypeEntityProcessor';
import { ProjectTypeEntityProcessor } from './ProjectTypeEntityProcessor';
import { ClusterDataplaneEntityProcessor } from './ClusterDataplaneEntityProcessor';
import { ClusterObservabilityPlaneEntityProcessor } from './ClusterObservabilityPlaneEntityProcessor';
import { ClusterTraitTypeEntityProcessor } from './ClusterTraitTypeEntityProcessor';
import { ClusterWorkflowEntityProcessor } from './ClusterWorkflowEntityProcessor';
import { ClusterWorkflowPlaneEntityProcessor } from './ClusterWorkflowPlaneEntityProcessor';
import { ComponentEntityProcessor } from './ComponentEntityProcessor';
import { ResourceEntityProcessor } from './ResourceEntityProcessor';
import { ComponentTypeEntityProcessor } from './ComponentTypeEntityProcessor';
import { CustomAnnotationProcessor } from './CustomAnnotationProcessor';
import { DataplaneEntityProcessor } from './DataplaneEntityProcessor';
import { DeploymentPipelineEntityProcessor } from './DeploymentPipelineEntityProcessor';
import { EnvironmentEntityProcessor } from './EnvironmentEntityProcessor';
import { ObservabilityAlertsNotificationChannelEntityProcessor } from './ObservabilityAlertsNotificationChannelEntityProcessor';
import { ObservabilityPlaneEntityProcessor } from './ObservabilityPlaneEntityProcessor';
import { SystemEntityProcessor } from './SystemEntityProcessor';
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
// ObservabilityAlertsNotificationChannelEntityProcessor
// ---------------------------------------------------------------------------
describe('ObservabilityAlertsNotificationChannelEntityProcessor', () => {
  const processor = new ObservabilityAlertsNotificationChannelEntityProcessor();

  describe('validateEntityKind', () => {
    it('returns true for ObservabilityAlertsNotificationChannel kind', async () => {
      expect(
        await processor.validateEntityKind({
          kind: 'ObservabilityAlertsNotificationChannel',
        } as any),
      ).toBe(true);
    });
    it('returns false for other kinds', async () => {
      expect(
        await processor.validateEntityKind({ kind: 'Environment' } as any),
      ).toBe(false);
    });
  });

  describe('postProcessEntity', () => {
    it('throws when spec.type is missing', async () => {
      const entity = {
        kind: 'ObservabilityAlertsNotificationChannel',
        metadata: { name: 'ch', namespace: 'my-ns' },
        spec: { environment: 'dev' },
      } as any;
      await expect(
        processor.postProcessEntity(entity, mockLocation, jest.fn()),
      ).rejects.toThrow('spec.type');
    });

    it('throws when spec.environment is missing', async () => {
      const entity = {
        kind: 'ObservabilityAlertsNotificationChannel',
        metadata: { name: 'ch', namespace: 'my-ns' },
        spec: { type: 'email' },
      } as any;
      await expect(
        processor.postProcessEntity(entity, mockLocation, jest.fn()),
      ).rejects.toThrow('spec.environment');
    });

    it('throws when type is "email" but spec.emailConfig is missing', async () => {
      const entity = {
        kind: 'ObservabilityAlertsNotificationChannel',
        metadata: { name: 'ch', namespace: 'my-ns' },
        spec: { type: 'email', environment: 'dev' },
      } as any;
      await expect(
        processor.postProcessEntity(entity, mockLocation, jest.fn()),
      ).rejects.toThrow('spec.emailConfig');
    });

    it('throws when type is "webhook" but spec.webhookConfig is missing', async () => {
      const entity = {
        kind: 'ObservabilityAlertsNotificationChannel',
        metadata: { name: 'ch', namespace: 'my-ns' },
        spec: { type: 'webhook', environment: 'dev' },
      } as any;
      await expect(
        processor.postProcessEntity(entity, mockLocation, jest.fn()),
      ).rejects.toThrow('spec.webhookConfig');
    });

    it('emits notifiedBy/notifies relations to the target Environment', async () => {
      const emit = jest.fn();
      const entity = {
        kind: 'ObservabilityAlertsNotificationChannel',
        metadata: { name: 'ch', namespace: 'my-ns' },
        spec: { type: 'email', environment: 'dev', emailConfig: {} },
      } as any;
      await processor.postProcessEntity(entity, mockLocation, emit);
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: {
            kind: 'observabilityalertsnotificationchannel',
            namespace: 'my-ns',
            name: 'ch',
          },
          target: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          type: RELATION_NOTIFIED_BY,
        }),
      );
      expect(emit).toHaveBeenCalledWith(
        processingResult.relation({
          source: { kind: 'environment', namespace: 'my-ns', name: 'dev' },
          target: {
            kind: 'observabilityalertsnotificationchannel',
            namespace: 'my-ns',
            name: 'ch',
          },
          type: RELATION_NOTIFIES,
        }),
      );
    });
  });

  describe('processEntity', () => {
    it('emits entity for ObservabilityAlertsNotificationChannel kind', async () => {
      const emit = jest.fn();
      const entity = {
        kind: 'ObservabilityAlertsNotificationChannel',
        metadata: { name: 'ch' },
        spec: { type: 'email', environment: 'dev' },
      } as any;
      await processor.processEntity(entity, mockLocation, emit);
      expect(emit).toHaveBeenCalledWith(
        processingResult.entity(mockLocation, entity),
      );
    });

    it('skips entities of other kinds', async () => {
      const emit = jest.fn();
      await processor.processEntity(
        { kind: 'Environment' } as any,
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
// ClusterResourceTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterResourceTypeEntityProcessor', () => {
  const processor = new ClusterResourceTypeEntityProcessor();

  it('validateEntityKind returns true for ClusterResourceType', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterResourceType',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'ResourceType' } as any),
    ).toBe(false);
  });

  it('postProcessEntity emits no relations', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      {
        kind: 'ClusterResourceType',
        metadata: { name: 'r' },
        spec: { retainPolicy: 'Delete' },
      } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ResourceTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ResourceTypeEntityProcessor', () => {
  const processor = new ResourceTypeEntityProcessor();

  it('validateEntityKind returns true for ResourceType', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'ResourceType' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterResourceType',
      } as any),
    ).toBe(false);
  });

  it('emits partOf domain relation', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ResourceType',
      metadata: { name: 'r', namespace: 'my-ns' },
      spec: { domain: 'my-ns', retainPolicy: 'Delete' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'resourcetype', namespace: 'my-ns', name: 'r' },
        target: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        target: { kind: 'resourcetype', namespace: 'my-ns', name: 'r' },
        type: RELATION_HAS_PART,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ClusterProjectTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ClusterProjectTypeEntityProcessor', () => {
  const processor = new ClusterProjectTypeEntityProcessor();

  it('validateEntityKind returns true for ClusterProjectType', async () => {
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterProjectType',
      } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'ProjectType' } as any),
    ).toBe(false);
  });

  it('postProcessEntity emits no relations', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      {
        kind: 'ClusterProjectType',
        metadata: { name: 'p' },
        spec: {},
      } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('getProcessorName returns the processor name', () => {
    expect(processor.getProcessorName()).toBe(
      'ClusterProjectTypeEntityProcessor',
    );
  });

  it('processEntity emits the entity for a ClusterProjectType', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterProjectType',
      metadata: { name: 'p' },
      spec: {},
    } as any;
    const result = await processor.processEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.entity(mockLocation, entity),
    );
    expect(result).toBe(entity);
  });

  it('processEntity passes through entities of other kinds without emitting', async () => {
    const emit = jest.fn();
    const entity = { kind: 'ProjectType', metadata: { name: 'p' } } as any;
    await processor.processEntity(entity, mockLocation, emit);
    expect(emit).not.toHaveBeenCalled();
  });

  it('preProcessEntity returns the entity unchanged', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterProjectType',
      metadata: { name: 'p' },
      spec: {},
    } as any;
    expect(await processor.preProcessEntity(entity, mockLocation, emit)).toBe(
      entity,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ProjectTypeEntityProcessor
// ---------------------------------------------------------------------------
describe('ProjectTypeEntityProcessor', () => {
  const processor = new ProjectTypeEntityProcessor();

  it('validateEntityKind returns true for ProjectType', async () => {
    expect(
      await processor.validateEntityKind({ kind: 'ProjectType' } as any),
    ).toBe(true);
    expect(
      await processor.validateEntityKind({
        kind: 'ClusterProjectType',
      } as any),
    ).toBe(false);
  });

  it('emits partOf domain relation', async () => {
    const emit = jest.fn();
    // Real translation sets spec.domain to `default/<namespace>`, so the Domain
    // target always resolves to the `default` namespace (where Domain entities
    // live), regardless of the ProjectType's own namespace.
    const entity = {
      kind: 'ProjectType',
      metadata: { name: 'p', namespace: 'my-ns' },
      spec: { domain: 'default/my-ns' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'projecttype', namespace: 'my-ns', name: 'p' },
        target: { kind: 'domain', namespace: 'default', name: 'my-ns' },
        type: RELATION_PART_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'domain', namespace: 'default', name: 'my-ns' },
        target: { kind: 'projecttype', namespace: 'my-ns', name: 'p' },
        type: RELATION_HAS_PART,
      }),
    );
  });

  it('postProcessEntity emits no relations when spec.domain is absent', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ProjectType',
      metadata: { name: 'p', namespace: 'my-ns' },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).not.toHaveBeenCalled();
  });

  it('postProcessEntity defaults the source namespace to "default" when unset', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ProjectType',
      metadata: { name: 'p' },
      spec: { domain: 'web' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'projecttype', namespace: 'default', name: 'p' },
        target: { kind: 'domain', namespace: 'default', name: 'web' },
        type: RELATION_PART_OF,
      }),
    );
  });

  it('getProcessorName returns the processor name', () => {
    expect(processor.getProcessorName()).toBe('ProjectTypeEntityProcessor');
  });

  it('processEntity emits the entity for a ProjectType', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ProjectType',
      metadata: { name: 'p', namespace: 'my-ns' },
      spec: {},
    } as any;
    const result = await processor.processEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.entity(mockLocation, entity),
    );
    expect(result).toBe(entity);
  });

  it('processEntity passes through entities of other kinds without emitting', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ClusterProjectType',
      metadata: { name: 'p' },
    } as any;
    await processor.processEntity(entity, mockLocation, emit);
    expect(emit).not.toHaveBeenCalled();
  });

  it('preProcessEntity returns the entity unchanged', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'ProjectType',
      metadata: { name: 'p', namespace: 'my-ns' },
      spec: {},
    } as any;
    expect(await processor.preProcessEntity(entity, mockLocation, emit)).toBe(
      entity,
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
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterobservabilityplane',
          namespace: 'openchoreo-cluster',
          name: 'cop',
        },
        target: {
          kind: 'clusterworkflowplane',
          namespace: 'openchoreo-cluster',
          name: 'cwp',
        },
        type: RELATION_OBSERVES,
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

  it('does not emit usesPipeline/pipelineUsedBy from projectRefs', async () => {
    // The Project↔Pipeline relation is now emitted by SystemEntityProcessor
    // from `System.spec.deploymentPipelineRef`. Emitting it from the DP side
    // caused stale relations on event-driven updates: when a Project's
    // pipeline ref changed, the *old* pipeline kept claiming the project
    // until the next periodic poll. Keeping `projectRefs` here as input but
    // asserting the relation is absent locks in the regression fence.
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
    const emitted = emit.mock.calls.map(([res]) => res);
    expect(
      emitted.some(
        r =>
          r?.type === 'relation' &&
          (r.relation.type === RELATION_USES_PIPELINE ||
            r.relation.type === RELATION_PIPELINE_USED_BY),
      ),
    ).toBe(false);
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
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'domain', namespace: 'my-ns', name: 'my-ns' },
        target: {
          kind: 'observabilityplane',
          namespace: 'my-ns',
          name: 'op',
        },
        type: RELATION_HAS_PART,
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

// ---------------------------------------------------------------------------
// SystemEntityProcessor
// ---------------------------------------------------------------------------
describe('SystemEntityProcessor', () => {
  const processor = new SystemEntityProcessor();

  it('emits usesPipeline/pipelineUsedBy from System.spec.deploymentPipelineRef', async () => {
    // This is the side that owns the foreign key. Emitting from the System
    // (Project) side ensures that re-processing the Project after an event
    // naturally produces the new relation set and discards the old one,
    // because Backstage scopes relation emission to the source entity.
    const emit = jest.fn();
    const entity = {
      kind: 'System',
      metadata: { name: 'proj-1', namespace: 'my-ns' },
      spec: { deploymentPipelineRef: 'pipe' },
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
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('does nothing when System has no deploymentPipelineRef', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'System',
      metadata: { name: 'proj-1', namespace: 'my-ns' },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).not.toHaveBeenCalled();
  });

  it('skips entities of other kinds', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      {
        kind: 'Component',
        metadata: { name: 'c', namespace: 'my-ns' },
        spec: { deploymentPipelineRef: 'pipe' },
      } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('falls back to namespace "default" when metadata.namespace is missing', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'System',
      metadata: { name: 'proj-1' },
      spec: { deploymentPipelineRef: 'pipe' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    const call = emit.mock.calls[0][0];
    expect(call.relation.source.namespace).toBe('default');
    expect(call.relation.target.namespace).toBe('default');
  });

  it('emits instanceOf/hasInstance to a namespaced ProjectType', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'System',
      metadata: {
        name: 'proj-1',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/project-type': 'standard-project',
          'openchoreo.io/project-type-kind': 'ProjectType',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'system', namespace: 'my-ns', name: 'proj-1' },
        target: {
          kind: 'projecttype',
          namespace: 'my-ns',
          name: 'standard-project',
        },
        type: RELATION_INSTANCE_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'projecttype',
          namespace: 'my-ns',
          name: 'standard-project',
        },
        target: { kind: 'system', namespace: 'my-ns', name: 'proj-1' },
        type: RELATION_HAS_INSTANCE,
      }),
    );
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it('targets the openchoreo-cluster namespace for a ClusterProjectType ref', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'System',
      metadata: {
        name: 'proj-1',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/project-type': 'global-project',
          'openchoreo.io/project-type-kind': 'ClusterProjectType',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'system', namespace: 'my-ns', name: 'proj-1' },
        target: {
          kind: 'clusterprojecttype',
          namespace: 'openchoreo-cluster',
          name: 'global-project',
        },
        type: RELATION_INSTANCE_OF,
      }),
    );
  });

  it('emits both pipeline and project-type relations when both are present', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'System',
      metadata: {
        name: 'proj-1',
        namespace: 'my-ns',
        annotations: {
          'openchoreo.io/project-type': 'standard-project',
          'openchoreo.io/project-type-kind': 'ProjectType',
        },
      },
      spec: { deploymentPipelineRef: 'pipe' },
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    // 2 pipeline + 2 project-type
    expect(emit).toHaveBeenCalledTimes(4);
  });
});

// ---------------------------------------------------------------------------
// ResourceEntityProcessor
// ---------------------------------------------------------------------------
describe('ResourceEntityProcessor', () => {
  const processor = new ResourceEntityProcessor();

  it('emits instanceOf/hasInstance to ResourceType when annotation is set', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Resource',
      metadata: {
        name: 'analytics-db',
        namespace: 'finance',
        annotations: {
          'openchoreo.io/resource-type': 'postgres',
          'openchoreo.io/resource-type-kind': 'ResourceType',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'resource',
          namespace: 'finance',
          name: 'analytics-db',
        },
        target: {
          kind: 'resourcetype',
          namespace: 'finance',
          name: 'postgres',
        },
        type: RELATION_INSTANCE_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'resourcetype',
          namespace: 'finance',
          name: 'postgres',
        },
        target: {
          kind: 'resource',
          namespace: 'finance',
          name: 'analytics-db',
        },
        type: RELATION_HAS_INSTANCE,
      }),
    );
  });

  it('targets ClusterResourceType when resource-type-kind annotation is set', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Resource',
      metadata: {
        name: 'orders-cache',
        namespace: 'sales',
        annotations: {
          'openchoreo.io/resource-type': 'valkey',
          'openchoreo.io/resource-type-kind': 'ClusterResourceType',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: { kind: 'resource', namespace: 'sales', name: 'orders-cache' },
        target: {
          kind: 'clusterresourcetype',
          namespace: 'openchoreo-cluster',
          name: 'valkey',
        },
        type: RELATION_INSTANCE_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: {
          kind: 'clusterresourcetype',
          namespace: 'openchoreo-cluster',
          name: 'valkey',
        },
        target: { kind: 'resource', namespace: 'sales', name: 'orders-cache' },
        type: RELATION_HAS_INSTANCE,
      }),
    );
  });

  it('skips non-Resource entities and Resources without the annotation', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      { kind: 'Environment', metadata: { name: 'x' } } as any,
      mockLocation,
      emit,
    );
    await processor.postProcessEntity(
      { kind: 'Resource', metadata: { name: 'x' } } as any,
      mockLocation,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('defaults to namespace "default" when metadata.namespace is missing', async () => {
    const emit = jest.fn();
    const entity = {
      kind: 'Resource',
      metadata: {
        name: 'no-ns',
        annotations: {
          'openchoreo.io/resource-type': 'postgres',
          'openchoreo.io/resource-type-kind': 'ResourceType',
        },
      },
      spec: {},
    } as any;
    await processor.postProcessEntity(entity, mockLocation, emit);
    const call = emit.mock.calls[0][0];
    expect(call.relation.source.namespace).toBe('default');
    expect(call.relation.target.namespace).toBe('default');
  });
});
