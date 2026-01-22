/**
 * The openchoreo backend module for the catalog plugin.
 *
 * @packageDocumentation
 */

export {
  catalogModuleOpenchoreo as default,
  immediateCatalogServiceFactory,
} from './module';
export { OpenChoreoEntityProvider } from './provider/OpenChoreoEntityProvider';
export { ScaffolderEntityProvider } from './provider/ScaffolderEntityProvider';
export {
  immediateCatalogServiceRef,
  type ImmediateCatalogService,
} from './service/ImmediateCatalogService';
export {
  translateComponentToEntity,
  type ComponentEntityTranslationConfig,
} from './utils/entityTranslation';
// Re-export relation constants from common package for convenience
export {
  RELATION_PROMOTES_TO,
  RELATION_PROMOTED_BY,
} from '@openchoreo/backstage-plugin-common';
