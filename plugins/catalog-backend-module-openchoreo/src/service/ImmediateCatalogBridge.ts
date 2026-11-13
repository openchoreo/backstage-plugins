import { Entity } from '@backstage/catalog-model';
import {
  createServiceFactory,
  createServiceRef,
} from '@backstage/backend-plugin-api';
import { ImmediateCatalogService } from './ImmediateCatalogService';

/**
 * Hands immediate catalog writes from other plugins (e.g. scaffolder actions)
 * to the catalog module's OpenChoreoEntityProvider.
 *
 * `ImmediateCatalogService` is plugin-scoped, so it is instantiated inside
 * whichever plugin consumes it, while the provider lives in the catalog
 * plugin. This root-scoped service is the single instance both sides share:
 * the catalog module attaches the provider, and the plugin-scoped service
 * forwards calls to it.
 */
export class ImmediateCatalogBridge implements ImmediateCatalogService {
  private target?: ImmediateCatalogService;

  /** Called by the catalog module with the provider that owns the entities. */
  attach(target: ImmediateCatalogService): void {
    this.target = target;
  }

  async insertEntity(entity: Entity): Promise<void> {
    return this.getTarget().insertEntity(entity);
  }

  async removeEntity(entityRef: string): Promise<void> {
    return this.getTarget().removeEntity(entityRef);
  }

  private getTarget(): ImmediateCatalogService {
    if (!this.target) {
      throw new Error(
        'ImmediateCatalogService is not ready: the OpenChoreo catalog module has not started. Make sure the catalog-backend-module-openchoreo is installed.',
      );
    }
    return this.target;
  }
}

/**
 * Internal, root-scoped reference for the {@link ImmediateCatalogBridge}.
 * Not exported from the package; the default factory installs it on demand.
 */
export const immediateCatalogBridgeRef =
  createServiceRef<ImmediateCatalogBridge>({
    id: 'openchoreo.immediate-catalog-bridge',
    scope: 'root',
    defaultFactory: async service =>
      createServiceFactory({
        service,
        deps: {},
        factory: () => new ImmediateCatalogBridge(),
      }),
  });
