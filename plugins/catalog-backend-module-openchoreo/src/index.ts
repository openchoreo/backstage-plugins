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
