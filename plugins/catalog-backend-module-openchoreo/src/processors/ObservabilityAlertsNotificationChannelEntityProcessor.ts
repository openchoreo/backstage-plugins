import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  RELATION_NOTIFIED_BY,
  RELATION_NOTIFIES,
} from '@openchoreo/backstage-plugin-common';
import { ObservabilityAlertsNotificationChannelEntityV1alpha1 } from '../kinds/ObservabilityAlertsNotificationChannelEntityV1alpha1';

/**
 * Processor for ObservabilityAlertsNotificationChannel entities
 */
export class ObservabilityAlertsNotificationChannelEntityProcessor
  implements CatalogProcessor
{
  getProcessorName(): string {
    return 'ObservabilityAlertsNotificationChannelEntityProcessor';
  }

  async validateEntityKind(
    entity: ObservabilityAlertsNotificationChannelEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ObservabilityAlertsNotificationChannel';
  }

  async postProcessEntity(
    entity: ObservabilityAlertsNotificationChannelEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ObservabilityAlertsNotificationChannelEntityV1alpha1> {
    if (entity.kind === 'ObservabilityAlertsNotificationChannel') {
      if (!entity.spec?.type) {
        throw new Error(
          'ObservabilityAlertsNotificationChannel entity must have spec.type',
        );
      }
      if (!entity.spec?.environment) {
        throw new Error(
          'ObservabilityAlertsNotificationChannel entity must have spec.environment',
        );
      }
      if (entity.spec.type === 'email' && !entity.spec.emailConfig) {
        throw new Error(
          'ObservabilityAlertsNotificationChannel entity with type "email" must have spec.emailConfig',
        );
      }
      if (entity.spec.type === 'webhook' && !entity.spec.webhookConfig) {
        throw new Error(
          'ObservabilityAlertsNotificationChannel entity with type "webhook" must have spec.webhookConfig',
        );
      }

      const sourceRef = {
        kind: entity.kind.toLowerCase(),
        namespace: entity.metadata.namespace || 'default',
        name: entity.metadata.name,
      };

      // Emit notifies/notifiedBy relationship to the target Environment
      const environmentRef = {
        kind: 'environment',
        namespace: entity.metadata.namespace || 'default',
        name: entity.spec.environment,
      };
      emit(
        processingResult.relation({
          source: sourceRef,
          target: environmentRef,
          type: RELATION_NOTIFIED_BY,
        }),
      );
      emit(
        processingResult.relation({
          source: environmentRef,
          target: sourceRef,
          type: RELATION_NOTIFIES,
        }),
      );
    }

    return entity;
  }

  async processEntity(
    entity: ObservabilityAlertsNotificationChannelEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ObservabilityAlertsNotificationChannelEntityV1alpha1> {
    if (entity.kind !== 'ObservabilityAlertsNotificationChannel') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
