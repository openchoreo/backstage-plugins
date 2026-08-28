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
 * Test suite for OpenChoreoIncrementalEntityProvider.
 * Verifies cursor-based phase traversal (namespaces -> projects ->
 * components), exact cursor chains, restart resumability, and failure
 * handling of the resumable incremental ingestion provider.
 */
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import type * as mockApi from '../testUtils/mockApi';
import {
  createMockClient,
  mockComponent,
  mockNamespace,
  mockProject,
} from '../testUtils/mockApi';
import {
  OpenChoreoIncrementalEntityProvider,
  type OpenChoreoCursor,
} from './OpenChoreoIncrementalEntityProvider';

jest.mock('@openchoreo/openchoreo-client-node', () =>
  (
    jest.requireActual('../testUtils/mockApi') as typeof mockApi
  ).mockOpenChoreoClientNodeModule(),
);
jest.mock('@openchoreo/backstage-plugin-catalog-backend-module', () =>
  (
    jest.requireActual('../testUtils/mockApi') as typeof mockApi
  ).mockCatalogBackendModule(),
);

const NAMESPACES_PATH = '/api/v1/namespaces';
const PROJECTS_PATH = '/api/v1/namespaces/{namespaceName}/projects';
const COMPONENTS_PATH = '/api/v1/namespaces/{namespaceName}/components';

function domain(name: string) {
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Domain',
      metadata: { name },
    },
  };
}

function system(name: string) {
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: { name },
    },
  };
}

function component(name: string) {
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name },
    },
  };
}

describe('OpenChoreoIncrementalEntityProvider', () => {
  const logger = mockServices.logger.mock();
  const context = { baseUrl: 'http://localhost:8080', logger };

  const createProvider = (chunkSize = 10) =>
    new OpenChoreoIncrementalEntityProvider({
      config: new ConfigReader({
        openchoreo: {
          baseUrl: 'http://localhost:8080',
          incremental: { chunkSize },
        },
      }),
      logger,
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns its provider name', () => {
    expect(createProvider().getProviderName()).toBe(
      'OpenChoreoIncrementalEntityProvider',
    );
  });

  it('around() supplies the burst with baseUrl, logger and token', async () => {
    const burst = jest.fn();
    await createProvider().around(burst);
    expect(burst).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:8080',
      logger,
      token: undefined,
    });
  });

  it('emits a Domain per namespace on the initial page and seeds the cursor', async () => {
    const client = createMockClient({
      [NAMESPACES_PATH]: [
        { items: [mockNamespace('ns-1'), mockNamespace('ns-2')] },
      ],
    });

    const result = await createProvider().next(context);

    expect(result).toEqual({
      done: false,
      entities: [domain('ns-1'), domain('ns-2')],
      cursor: {
        phase: 'projects',
        namespaceApiCursor: undefined,
        namespaceQueue: ['ns-1', 'ns-2'],
        currentIndex: 0,
      },
    });
    expect(client.calls).toEqual([
      { path: NAMESPACES_PATH, params: { query: { limit: 10 } } },
    ]);
    expect(createOpenChoreoApiClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'http://localhost:8080', logger }),
    );
  });

  it('continues namespaces through namespaceApiCursor and moves to projects when the list ends', async () => {
    const client = createMockClient({
      [NAMESPACES_PATH]: [
        { items: [mockNamespace('ns-1')], nextCursor: 'ns-c1' },
        { items: [mockNamespace('ns-2')] },
      ],
    });
    const provider = createProvider();

    const first = await provider.next(context);
    expect(first.done).toBe(false);
    expect(first.cursor).toEqual({
      phase: 'namespaces',
      namespaceApiCursor: 'ns-c1',
      namespaceQueue: ['ns-1'],
      currentIndex: 0,
    });

    const second = await provider.next(context, first.cursor);
    expect(second).toEqual({
      done: false,
      entities: [domain('ns-2')],
      cursor: {
        phase: 'projects',
        namespaceApiCursor: undefined,
        namespaceQueue: ['ns-1', 'ns-2'],
        currentIndex: 0,
      },
    });
    expect(client.calls[1]).toEqual({
      path: NAMESPACES_PATH,
      params: { query: { limit: 10, cursor: 'ns-c1' } },
    });
  });

  it('walks an exact three-page namespace cursor chain', async () => {
    const client = createMockClient({
      [NAMESPACES_PATH]: [
        { items: [mockNamespace('ns-a')], nextCursor: 'ns-c1' },
        { items: [mockNamespace('ns-b')], nextCursor: 'ns-c2' },
        { items: [mockNamespace('ns-c')] },
      ],
    });
    const provider = createProvider();

    const first = await provider.next(context);
    const second = await provider.next(context, first.cursor);
    const third = await provider.next(context, second.cursor);

    expect(client.calls.map(call => call.params?.query)).toEqual([
      { limit: 10 },
      { limit: 10, cursor: 'ns-c1' },
      { limit: 10, cursor: 'ns-c2' },
    ]);
    expect(first.cursor).toEqual({
      phase: 'namespaces',
      namespaceApiCursor: 'ns-c1',
      namespaceQueue: ['ns-a'],
      currentIndex: 0,
    });
    expect(second.cursor).toEqual({
      phase: 'namespaces',
      namespaceApiCursor: 'ns-c2',
      namespaceQueue: ['ns-a', 'ns-b'],
      currentIndex: 0,
    });
    expect(third).toEqual({
      done: false,
      entities: [domain('ns-c')],
      cursor: {
        phase: 'projects',
        namespaceApiCursor: undefined,
        namespaceQueue: ['ns-a', 'ns-b', 'ns-c'],
        currentIndex: 0,
      },
    });
  });

  it('pages projects per namespace, advances currentIndex and transitions to components', async () => {
    const client = createMockClient({
      ['/api/v1/namespaces/ns-1/projects']: [
        { items: [mockProject('proj-1a')], nextCursor: 'pr-ns1-c1' },
        { items: [mockProject('proj-1b')] },
      ],
      ['/api/v1/namespaces/ns-2/projects']: [
        { items: [mockProject('proj-2a')] },
      ],
    });
    const provider = createProvider();
    const cursor: OpenChoreoCursor = {
      phase: 'projects',
      namespaceQueue: ['ns-1', 'ns-2'],
      currentIndex: 0,
    };

    const first = await provider.next(context, cursor);
    expect(first).toEqual({
      done: false,
      entities: [system('proj-1a')],
      cursor: {
        ...cursor,
        projectApiCursor: 'pr-ns1-c1',
        currentNamespace: 'ns-1',
      },
    });

    const second = await provider.next(context, first.cursor);
    expect(second).toEqual({
      done: false,
      entities: [system('proj-1b')],
      cursor: {
        ...cursor,
        projectApiCursor: undefined,
        currentIndex: 1,
        currentNamespace: 'ns-1',
      },
    });

    const third = await provider.next(context, second.cursor);
    expect(third).toEqual({
      done: false,
      entities: [system('proj-2a')],
      cursor: {
        ...cursor,
        projectApiCursor: undefined,
        currentIndex: 2,
        currentNamespace: 'ns-2',
      },
    });

    // Queue exhausted: pure transition call, no extra GET.
    const fourth = await provider.next(context, third.cursor);
    expect(fourth).toEqual({
      done: false,
      entities: [],
      cursor: {
        phase: 'components',
        namespaceQueue: ['ns-1', 'ns-2'],
        currentIndex: 0,
        projectApiCursor: undefined,
        currentNamespace: 'ns-2',
      },
    });
    expect(client.calls).toEqual([
      {
        path: PROJECTS_PATH,
        params: { path: { namespaceName: 'ns-1' }, query: { limit: 10 } },
      },
      {
        path: PROJECTS_PATH,
        params: {
          path: { namespaceName: 'ns-1' },
          query: { limit: 10, cursor: 'pr-ns1-c1' },
        },
      },
      {
        path: PROJECTS_PATH,
        params: { path: { namespaceName: 'ns-2' }, query: { limit: 10 } },
      },
    ]);
  });

  it('fetches components flat per namespace without a project filter and finishes only after the last page', async () => {
    const client = createMockClient({
      ['/api/v1/namespaces/ns-1/components']: [
        { items: [mockComponent('cmp-1')], nextCursor: 'cmp-ns1-c1' },
        { items: [mockComponent('cmp-2')] },
      ],
      ['/api/v1/namespaces/ns-2/components']: [
        { items: [mockComponent('cmp-3')] },
      ],
    });
    const provider = createProvider();
    const cursor: OpenChoreoCursor = {
      phase: 'components',
      namespaceQueue: ['ns-1', 'ns-2'],
      currentIndex: 0,
    };

    const first = await provider.next(context, cursor);
    expect(first.done).toBe(false);
    expect(first.entities).toEqual([component('cmp-1')]);
    // The component list is flat: no project filter is sent.
    expect(client.calls[0]).toEqual({
      path: COMPONENTS_PATH,
      params: { path: { namespaceName: 'ns-1' }, query: { limit: 10 } },
    });
    expect(client.calls[0].params?.query).not.toHaveProperty('projectName');
    expect(first.cursor).toMatchObject({
      componentApiCursor: 'cmp-ns1-c1',
      currentIndex: 0,
      currentNamespace: 'ns-1',
    });

    const second = await provider.next(context, first.cursor);
    expect(second.done).toBe(false);
    expect(second.entities).toEqual([component('cmp-2')]);
    expect(second.cursor).toMatchObject({
      componentApiCursor: undefined,
      currentIndex: 1,
    });

    const third = await provider.next(context, second.cursor);
    expect(third.done).toBe(false);
    expect(third.entities).toEqual([component('cmp-3')]);
    expect(third.cursor).toMatchObject({ currentIndex: 2 });

    // Only the call past the last namespace's last page reports done.
    const fourth = await provider.next(context, third.cursor);
    expect(fourth).toEqual({ done: true });
    expect(client.calls).toHaveLength(3);
  });

  it('resumes a JSON round-tripped cursor in a brand new provider instance', async () => {
    const client = createMockClient({
      [NAMESPACES_PATH]: [
        { items: [mockNamespace('ns-a')], nextCursor: 'ns-c1' },
        { items: [mockNamespace('ns-b')], nextCursor: 'ns-c2' },
        { items: [mockNamespace('ns-c')] },
      ],
    });
    const firstProvider = createProvider();

    const first = await firstProvider.next(context);
    const second = await firstProvider.next(context, first.cursor);

    // Simulate persisting the cursor to the ingestion database and
    // restarting the process: a fresh provider instance receives the
    // cursor after a JSON round-trip.
    const restartedCursor = JSON.parse(
      JSON.stringify(second.cursor),
    ) as OpenChoreoCursor;
    const restartedProvider = createProvider();
    const third = await restartedProvider.next(context, restartedCursor);

    expect(third).toEqual({
      done: false,
      entities: [domain('ns-c')],
      cursor: {
        phase: 'projects',
        namespaceApiCursor: undefined,
        namespaceQueue: ['ns-a', 'ns-b', 'ns-c'],
        currentIndex: 0,
      },
    });
    expect(client.calls[2]).toEqual({
      path: NAMESPACES_PATH,
      params: { query: { limit: 10, cursor: 'ns-c2' } },
    });
  });

  it('rejects a stuck namespace cursor that echoes back unchanged', async () => {
    createMockClient({
      [NAMESPACES_PATH]: [
        { items: [mockNamespace('ns-1')], nextCursor: 'stuck-ns-cursor' },
        { items: [mockNamespace('ns-2')], nextCursor: 'stuck-ns-cursor' },
      ],
    });
    const provider = createProvider();

    const first = await provider.next(context);
    await expect(provider.next(context, first.cursor)).rejects.toThrow(
      "same pagination cursor for namespaces twice ('stuck-ns-cursor')",
    );
  });

  it('rejects a stuck project cursor, naming the namespace', async () => {
    createMockClient({
      ['/api/v1/namespaces/ns-1/projects']: [
        { items: [mockProject('proj-1')], nextCursor: 'stuck-pr-cursor' },
        { items: [mockProject('proj-1-echo')], nextCursor: 'stuck-pr-cursor' },
      ],
    });
    const provider = createProvider();

    await expect(
      provider.next(context, {
        phase: 'projects',
        namespaceQueue: ['ns-1'],
        currentIndex: 0,
        projectApiCursor: 'stuck-pr-cursor',
      }),
    ).rejects.toThrow(
      "same pagination cursor for projects in namespace ns-1 twice ('stuck-pr-cursor')",
    );
  });

  it('rejects with the response status when the namespaces fetch fails', async () => {
    createMockClient({
      [NAMESPACES_PATH]: [
        { status: 500, error: { message: 'upstream exploded' } },
      ],
    });

    await expect(createProvider().next(context)).rejects.toThrow(
      'Failed to fetch namespaces: 500 HTTP 500 - upstream exploded',
    );
  });

  it('rejects with the response status when a projects fetch fails', async () => {
    createMockClient({
      ['/api/v1/namespaces/ns-1/projects']: [
        { status: 404, error: { message: 'namespace not found' } },
      ],
    });

    await expect(
      createProvider().next(context, {
        phase: 'projects',
        namespaceQueue: ['ns-1'],
        currentIndex: 0,
      }),
    ).rejects.toThrow(
      'Failed to fetch projects for namespace ns-1: 404 HTTP 404 - namespace not found',
    );
  });

  it('caps a configured chunkSize of 500 to the API maximum of 100', async () => {
    const client = createMockClient({
      [NAMESPACES_PATH]: [{ items: [mockNamespace('ns-1')] }],
    });

    await createProvider(500).next(context);

    expect(client.calls[0].params?.query?.limit).toBe(100);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Configured chunkSize 500 exceeds API max; capping to 100',
      ),
    );
  });
});
