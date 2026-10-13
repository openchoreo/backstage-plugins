/**
 * The openchoreo backend module for the catalog plugin.
 *
 * @packageDocumentation
 */

import { createBackendFeatureLoader } from '@backstage/backend-plugin-api';
import {
  catalogModuleOpenchoreo,
  immediateCatalogServiceFactory,
  annotationStoreFactory,
} from './module';

export {
  catalogModuleOpenchoreo,
  immediateCatalogServiceFactory,
  annotationStoreFactory,
} from './module';

/**
 * Default export for this package.
 *
 * A feature loader rather than the catalog module alone, so the two service
 * factories the module and `@openchoreo/backstage-plugin-backend` both depend
 * on arrive with it. `AnnotationStore` is shared between them, and
 * `ImmediateCatalogService` is what lets scaffolder actions write an entity
 * without waiting for the next sync.
 *
 * Backend feature discovery reads a package's default export only, so shipping
 * the module on its own would install it without those services.
 *
 * Adding either factory explicitly with `backend.add(...)` as well is safe: an
 * explicitly installed service factory takes precedence and the one offered by
 * this loader is ignored.
 */
export default createBackendFeatureLoader({
  *loader() {
    yield catalogModuleOpenchoreo;
    yield immediateCatalogServiceFactory;
    yield annotationStoreFactory;
  },
});
export { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
export { ScaffolderEntityProvider } from './provider/ScaffolderEntityProvider';
export {
  immediateCatalogServiceRef,
  type ImmediateCatalogService,
} from './service/ImmediateCatalogService';
export {
  annotationStoreRef,
  type AnnotationStore,
} from './service/AnnotationStore';
export {
  translateComponentToEntity,
  translateProjectToEntity,
  translateEnvironmentToEntity,
  translateComponentTypeToEntity,
  translateResourceTypeToEntity,
  translateProjectTypeToEntity,
  translateResourceToEntity,
  translateTraitToEntity,
  translateWorkflowToEntity,
  translateNamespaceToDomainEntity,
  translateClusterComponentTypeToEntity,
  translateClusterResourceTypeToEntity,
  translateClusterProjectTypeToEntity,
  translateClusterTraitToEntity,
  translateHookToEntity,
  translateClusterHookToEntity,
  translateNewHookToEntity,
  translateNewClusterHookToEntity,
  translateClusterWorkflowToEntity,
  translateDeploymentPipelineToEntity,
  translateNotificationChannelToEntity,
  extractWorkflowParameters,
  type ComponentEntityTranslationConfig,
  type EntityTranslationConfig,
  type HookSpecInput,
  type ProjectEntityTranslationConfig,
  type NamespaceEntityTranslationConfig,
} from './utils/entityTranslation';
// Re-export relation constants from common package for convenience
export {
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
} from '@openchoreo/backstage-plugin-common';
