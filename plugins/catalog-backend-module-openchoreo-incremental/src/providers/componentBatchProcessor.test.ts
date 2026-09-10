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
 * Test suite for ComponentBatchProcessor.
 * Verifies batch translation of flat per-namespace components through the
 * shared translator of the non-incremental sibling module, including the
 * project attribution rules (spec.owner.projectName with namespace
 * fallback) and nameless-item skipping.
 */
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { ComponentTypeUtils } from '@openchoreo/backstage-plugin-common';
import { translateComponentToEntity } from '@openchoreo/backstage-plugin-catalog-backend-module';
import type * as mockApi from '../testUtils/mockApi';
import { createMockClient, mockComponent } from '../testUtils/mockApi';
import { ComponentBatchProcessor } from './componentBatchProcessor';

jest.mock('@openchoreo/backstage-plugin-catalog-backend-module', () =>
  (
    jest.requireActual('../testUtils/mockApi') as typeof mockApi
  ).mockCatalogBackendModule(),
);

describe('ComponentBatchProcessor', () => {
  const logger = mockServices.logger.mock();
  const processor = new ComponentBatchProcessor({
    locationKey: 'provider:OpenChoreoIncrementalEntityProvider',
    defaultOwner: 'group:default/openchoreo-users',
    componentTypeUtils: ComponentTypeUtils.createDefault(),
  });
  const context = { logger, config: new ConfigReader({}) };

  const run = (
    components: Parameters<
      ComponentBatchProcessor['translateComponentsWithApisBatch']
    >[1],
  ) =>
    processor.translateComponentsWithApisBatch(
      createMockClient({}) as never,
      components,
      'ns-1',
      context,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('translates every component through the shared translator', async () => {
    const entities = await run([
      mockComponent('svc-ready'),
      mockComponent('svc-not-ready', {
        status: {
          conditions: [
            {
              type: 'Ready',
              status: 'False',
              reason: 'RenderingFailed',
            },
          ],
        },
      }),
    ]);

    expect(entities).toEqual([
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'svc-ready' },
      },
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'svc-not-ready' },
      },
    ]);
    expect(translateComponentToEntity).toHaveBeenCalledTimes(2);
    expect(translateComponentToEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'svc-ready',
        type: 'deployment/service',
        status: 'Ready',
      }),
      'ns-1',
      'svc-ready-project',
      expect.objectContaining({
        defaultOwner: 'group:default/openchoreo-users',
        componentTypeUtils: expect.any(ComponentTypeUtils),
        locationKey: 'provider:OpenChoreoIncrementalEntityProvider',
      }),
    );
    expect(translateComponentToEntity).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'svc-not-ready', status: 'Not Ready' }),
      'ns-1',
      'svc-not-ready-project',
      expect.anything(),
    );
  });

  it('attributes the component to spec.owner.projectName', async () => {
    await run([
      mockComponent('svc', { spec: { owner: { projectName: 'proj-x' } } }),
    ]);

    expect(translateComponentToEntity).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'svc' }),
      'ns-1',
      'proj-x',
      expect.anything(),
    );
  });

  it('falls back to the namespace when spec.owner.projectName is absent', async () => {
    const entities = await run([
      mockComponent('orphan', { spec: { owner: {} } }),
    ]);

    expect(entities).toEqual([
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'orphan' },
      },
    ]);
    expect(translateComponentToEntity).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'orphan' }),
      'ns-1',
      'ns-1',
      expect.anything(),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Component orphan in namespace ns-1 has no project reference',
      ),
    );
  });

  it('skips components without a name', async () => {
    const entities = await run([
      mockComponent('anonymous', { metadata: { name: undefined } }),
    ]);

    expect(entities).toEqual([]);
    expect(translateComponentToEntity).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Skipping component without a name in namespace ns-1',
      ),
    );
  });
});
