/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Main module for OpenChoreo incremental ingestion entity provider.
 * Defines the extension point and backend module for registering and managing incremental providers.
 */

import {
  coreServices,
  createBackendModule,
  createExtensionPoint,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { WrapperProviders } from './WrapperProviders';
import { eventsServiceRef } from '@backstage/plugin-events-node';
import {
  IncrementalEntityProvider,
  IncrementalEntityProviderOptions,
} from '../types';

/**
 * @public
 * Interface for {@link openchoreoIncrementalProvidersExtensionPoint}.
 */
export interface OpenChoreoIncrementalProviderExtensionPoint {
  /** Adds a new incremental entity provider */
  addProvider<TCursor, TContext>(config: {
    options: IncrementalEntityProviderOptions;
    provider: IncrementalEntityProvider<TCursor, TContext>;
  }): void;
}

/**
 * @public
 *
 * Extension point for registering OpenChoreo incremental ingestion providers.
 * The `catalogModuleOpenchoreoIncrementalEntityProvider` must be installed for these providers to work.
 *
 * @example
 *
 * ```ts
backend.add(createBackendModule({
  pluginId: 'catalog',
  moduleId: 'my-openchoreo-incremental-provider',
  register(env) {
    env.registerInit({
      deps: {
        extension: openchoreoIncrementalProvidersExtensionPoint,
      },
      async init({ extension }) {
        extension.addProvider({
          options: {
            burstInterval:,
            burstLength:,
            restLength: ,
          },
          provider: {
            next(context, cursor) {
            },
          },
        });
      },
    });
}))
 * ```
**/
export const openchoreoIncrementalProvidersExtensionPoint =
  createExtensionPoint<OpenChoreoIncrementalProviderExtensionPoint>({
    id: 'catalog.openchoreoIncrementalProvider.providers',
  });

/**
 * Registers the incremental entity provider with the catalog processing extension point for OpenChoreo.
 *
 * @public
 */
export const catalogModuleOpenchoreoIncrementalEntityProvider =
  createBackendModule({
    pluginId: 'catalog',
    moduleId: 'openchoreo-incremental-entity-provider',
    register(env) {
      const addedProviders = new Array<{
        provider: IncrementalEntityProvider<unknown, unknown>;
        options: IncrementalEntityProviderOptions;
      }>();

      env.registerExtensionPoint(openchoreoIncrementalProvidersExtensionPoint, {
        addProvider({ options, provider }) {
          addedProviders.push({ options, provider });
        },
      });

      env.registerInit({
        deps: {
          catalog: catalogProcessingExtensionPoint,
          config: coreServices.rootConfig,
          database: coreServices.database,
          httpRouter: coreServices.httpRouter,
          logger: coreServices.logger,
          scheduler: coreServices.scheduler,
          events: eventsServiceRef,
        },
        async init({
          catalog,
          config,
          database,
          httpRouter,
          logger,
          scheduler,
          events,
        }) {
          const client = await database.getClient();

          const providers = new WrapperProviders({
            config,
            logger,
            client,
            scheduler,
            events,
          });

          for (const entry of addedProviders) {
            const wrapped = providers.wrap(entry.provider, entry.options);
            catalog.addEntityProvider(wrapped);
          }

          httpRouter.use(providers.adminRouter());
        },
      });
    },
  });
