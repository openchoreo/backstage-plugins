import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  CompoundEntityRef,
  RELATION_API_PROVIDED_BY,
  RELATION_HAS_PART,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_PART_OF,
  RELATION_PROVIDES_API,
  parseEntityRef,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  CHOREO_ANNOTATIONS,
  RELATION_HAS_INSTANCE,
  RELATION_INSTANCE_OF,
  RELATION_ROUTED_BY,
  RELATION_ROUTES_TO,
} from '@openchoreo/backstage-plugin-common';
import { EndpointEntityV1alpha1 } from '../kinds/EndpointEntityV1alpha1';

/**
 * Processor for Endpoint entities. Endpoint is a custom kind, so the
 * relations the built-in processor emits for Components (owner, system,
 * providesApis) are emitted here, alongside instanceOf to the
 * (Cluster)EndpointType and routesTo each backend Component.
 */
export class EndpointEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'EndpointEntityProcessor';
  }

  async validateEntityKind(entity: EndpointEntityV1alpha1): Promise<boolean> {
    return entity.kind === 'Endpoint';
  }

  async postProcessEntity(
    entity: EndpointEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<EndpointEntityV1alpha1> {
    if (entity.kind !== 'Endpoint') {
      return entity;
    }

    const namespace = entity.metadata.namespace || 'default';
    const selfRef: CompoundEntityRef = {
      kind: 'endpoint',
      namespace,
      name: entity.metadata.name,
    };
    const emitPair = (
      target: CompoundEntityRef,
      forward: string,
      inverse: string,
    ) => {
      emit(
        processingResult.relation({ source: selfRef, target, type: forward }),
      );
      emit(
        processingResult.relation({
          source: target,
          target: selfRef,
          type: inverse,
        }),
      );
    };

    if (entity.spec.owner) {
      emitPair(
        parseEntityRef(entity.spec.owner, {
          defaultKind: 'group',
          defaultNamespace: namespace,
        }),
        RELATION_OWNED_BY,
        RELATION_OWNER_OF,
      );
    }

    if (entity.spec.system) {
      emitPair(
        parseEntityRef(entity.spec.system, {
          defaultKind: 'system',
          defaultNamespace: namespace,
        }),
        RELATION_PART_OF,
        RELATION_HAS_PART,
      );
    }

    const typeName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENDPOINTTYPE];
    if (typeName) {
      const isClusterType =
        entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENDPOINTTYPE_KIND] ===
        'ClusterEndpointType';
      emitPair(
        {
          kind: isClusterType ? 'clusterendpointtype' : 'endpointtype',
          namespace: isClusterType ? 'openchoreo-cluster' : namespace,
          name: typeName,
        },
        RELATION_INSTANCE_OF,
        RELATION_HAS_INSTANCE,
      );
    }

    // Several backends may name the same component (e.g. two of its
    // workload endpoints); one relation per component is enough.
    const components = new Set(
      (entity.spec.backends ?? [])
        .map(b => b.component)
        .filter((c): c is string => !!c),
    );
    for (const component of components) {
      emitPair(
        { kind: 'component', namespace, name: component },
        RELATION_ROUTES_TO,
        RELATION_ROUTED_BY,
      );
    }

    if (entity.spec.providesApi) {
      emitPair(
        parseEntityRef(entity.spec.providesApi, {
          defaultKind: 'api',
          defaultNamespace: namespace,
        }),
        RELATION_PROVIDES_API,
        RELATION_API_PROVIDED_BY,
      );
    }

    return entity;
  }
}
