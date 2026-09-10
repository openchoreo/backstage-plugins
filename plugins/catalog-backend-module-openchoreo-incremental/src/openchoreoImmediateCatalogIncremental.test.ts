/*
 * Copyright 2023 The Backstage Authors
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
 * Test suite for openchoreoImmediateCatalogIncremental.
 * Drives the backend module and the immediate-catalog service factory
 * through startTestBackend with a recording catalogProcessingExtensionPoint
 * double. The module and the factory share one ScaffolderEntityProvider
 * instance: the provider registered with the catalog engine is the same one
 * that backs the insertEntity/removeEntity service, and its delta mutations
 * carry the location key of the main incremental provider so full syncs keep
 * managing the same bucket of entities.
 */
import { startTestBackend } from '@backstage/backend-test-utils';
import { createBackendModule } from '@backstage/backend-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import type {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import {
  immediateCatalogServiceRef,
  type ImmediateCatalogService,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import {
  catalogModuleOpenchoreoImmediateCatalogIncremental,
  openchoreoImmediateCatalogIncrementalServiceFactory,
} from './openchoreoImmediateCatalogIncremental';

jest.setTimeout(60_000);

function makeEntity(name: string): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { namespace: 'default', name },
  };
}

/** Builds a throwaway catalog module that captures the plugin-scoped service. */
function makeServiceCapture(target: { service?: ImmediateCatalogService }) {
  return createBackendModule({
    pluginId: 'catalog',
    moduleId: 'capture-immediate-catalog-service',
    register(env) {
      env.registerInit({
        deps: { service: immediateCatalogServiceRef },
        async init({ service }) {
          target.service = service;
        },
      });
    },
  });
}

describe('openchoreoImmediateCatalogIncremental', () => {
  it('registers a scaffolder entity provider with the catalog engine', async () => {
    const addEntityProvider = jest.fn();

    const backend = await startTestBackend({
      extensionPoints: [
        [catalogProcessingExtensionPoint, { addEntityProvider }],
      ],
      features: [catalogModuleOpenchoreoImmediateCatalogIncremental],
    });

    try {
      expect(addEntityProvider).toHaveBeenCalledTimes(1);
      const provider = addEntityProvider.mock.calls[0][0] as EntityProvider;
      expect(provider.getProviderName()).toBe('ScaffolderEntityProvider');
      // The provider stays unconnected here; the shared instance is driven
      // through the service in the test below.
    } finally {
      await backend.stop();
    }
  });

  it('routes immediate insert and remove mutations through the shared provider', async () => {
    const addEntityProvider = jest.fn();
    const captured: { service?: ImmediateCatalogService } = {};

    const backend = await startTestBackend({
      extensionPoints: [
        [catalogProcessingExtensionPoint, { addEntityProvider }],
      ],
      features: [
        catalogModuleOpenchoreoImmediateCatalogIncremental,
        openchoreoImmediateCatalogIncrementalServiceFactory,
        makeServiceCapture(captured),
      ],
    });

    try {
      expect(captured.service).toBeDefined();
      expect(captured.service!.insertEntity).toBeInstanceOf(Function);
      expect(captured.service!.removeEntity).toBeInstanceOf(Function);

      const provider = addEntityProvider.mock.calls[0][0] as EntityProvider;
      const applyMutation = jest.fn();
      const connection: EntityProviderConnection = {
        applyMutation,
        refresh: jest.fn(),
      };

      // Before the catalog engine connects the provider, mutations fail.
      await expect(
        captured.service!.insertEntity(makeEntity('too-early')),
      ).rejects.toThrow(/not connected/i);

      await provider.connect(connection);

      await captured.service!.insertEntity(makeEntity('hello'));
      expect(applyMutation).toHaveBeenCalledTimes(1);
      expect(applyMutation).toHaveBeenNthCalledWith(1, {
        type: 'delta',
        added: [
          {
            entity: makeEntity('hello'),
            locationKey: 'provider:OpenChoreoIncrementalEntityProvider',
          },
        ],
        removed: [],
      });

      await captured.service!.removeEntity('component:default/hello');
      expect(applyMutation).toHaveBeenCalledTimes(2);
      expect(applyMutation).toHaveBeenNthCalledWith(2, {
        type: 'delta',
        added: [],
        removed: [
          {
            entityRef: 'component:default/hello',
            locationKey: 'provider:OpenChoreoIncrementalEntityProvider',
          },
        ],
      });
    } finally {
      await backend.stop();
    }
  });
});
