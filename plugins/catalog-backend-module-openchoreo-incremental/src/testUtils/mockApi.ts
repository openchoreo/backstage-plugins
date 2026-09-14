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
 * Shared test doubles for the incremental ingestion test suites.
 *
 * - `createMockClient` builds a cursor-following stand-in for the typed
 *   API client returned by `createOpenChoreoApiClient`. Routes map an API
 *   path (templated or concrete, e.g. `/api/v1/namespaces/my-ns/projects`)
 *   to the list of pages the "server" serves for it; `GET` walks the pages
 *   by cursor chain and records every (path, params) invocation.
 * - `mockOpenChoreoClientNodeModule` and `mockCatalogBackendModule`
 *   produce `jest.mock` module factories for the client package and the
 *   non-incremental sibling module respectively.
 * - `mockNamespace` / `mockProject` / `mockComponent` build K8s-style
 *   resource fixtures shaped like the new OpenChoreo API responses.
 */

import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type NewNamespace = OpenChoreoComponents['schemas']['Namespace'];
type NewProject = OpenChoreoComponents['schemas']['Project'];
type NewComponent = OpenChoreoComponents['schemas']['Component'];

/** One page of a cursor-paginated list response. */
export interface MockPage {
  items: unknown[];
  /** Cursor the server reports as the start of the next page. */
  nextCursor?: string;
}

/** A scripted page that makes the client return an error response. */
export interface MockErrorPage {
  status: number;
  statusText?: string;
  error?: { message: string };
}

/** The scripted pages served for one route. */
export type MockRoutePages = Array<MockPage | MockErrorPage>;

/** A recorded `client.GET(path, { params })` invocation. */
export interface MockGetCall {
  path: string;
  params?: {
    path?: Record<string, string>;
    query?: Record<string, unknown>;
  };
}

/** A mock typed API client that walks scripted pages by cursor. */
export interface MockApiClient {
  GET: jest.Mock;
  /** Every (path, params) pair the client was called with, in order. */
  calls: MockGetCall[];
}

/** Recursively optional overrides for the fixture builders. */
type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function isErrorPage(page: MockPage | MockErrorPage): page is MockErrorPage {
  return (page as MockErrorPage).status !== undefined;
}

/**
 * Resolves the page for a request cursor: `undefined` starts at the first
 * page; a cursor equal to `pages[i].nextCursor` advances to `pages[i + 1]`.
 */
function resolvePage(
  pages: MockRoutePages,
  cursor: string | undefined,
): MockPage | MockErrorPage | undefined {
  if (cursor === undefined) {
    return pages[0];
  }
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!isErrorPage(page) && page.nextCursor === cursor) {
      return pages[i + 1];
    }
  }
  return undefined;
}

/**
 * Looks up the scripted pages for a call. Concrete path keys (with path
 * params substituted, e.g. `/api/v1/namespaces/ns-1/projects`) win over
 * templated keys so each namespace can serve its own page set.
 */
function resolveRoute(
  routes: Record<string, MockRoutePages>,
  path: string,
  params?: MockGetCall['params'],
): MockRoutePages | undefined {
  if (params?.path) {
    const concrete = path.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
      params.path && key in params.path
        ? String(params.path[key])
        : placeholder,
    );
    if (routes[concrete]) {
      return routes[concrete];
    }
  }
  return routes[path];
}

function errorResult(page: MockErrorPage) {
  return {
    data: undefined,
    error: page.error ?? { message: `Request failed with ${page.status}` },
    response: {
      ok: false,
      status: page.status,
      statusText: page.statusText ?? `HTTP ${page.status}`,
    },
  };
}

/** The most recently created mock client, served by the module factory. */
let activeClient: MockApiClient | undefined;

/**
 * Creates a cursor-following mock API client and installs it as the client
 * returned by the mocked `createOpenChoreoApiClient`.
 */
export function createMockClient(
  routes: Record<string, MockRoutePages>,
): MockApiClient {
  const calls: MockGetCall[] = [];
  const client: MockApiClient = {
    calls,
    GET: jest.fn(
      async (
        path: string,
        options?: { params?: MockGetCall['params'] },
      ): Promise<unknown> => {
        const params = options?.params;
        calls.push({ path, params });

        const pages = resolveRoute(routes, path, params);
        const cursor =
          typeof params?.query?.cursor === 'string'
            ? params.query.cursor
            : undefined;
        const page = pages ? resolvePage(pages, cursor) : undefined;

        if (!page) {
          return errorResult({
            status: 400,
            error: {
              message: `No mock page for cursor '${cursor}' on ${path}`,
            },
          });
        }
        if (isErrorPage(page)) {
          return errorResult(page);
        }
        return {
          data: {
            items: page.items,
            pagination: page.nextCursor ? { nextCursor: page.nextCursor } : {},
          },
          error: undefined,
          response: { ok: true, status: 200, statusText: 'OK' },
        };
      },
    ),
  };
  activeClient = client;
  return client;
}

/**
 * `jest.mock` factory for '@openchoreo/openchoreo-client-node'. Keeps the
 * real resource helpers (getName, isReady, ...) and replaces only the
 * client factory with one returning the mock installed by
 * {@link createMockClient}.
 */
export function mockOpenChoreoClientNodeModule() {
  return {
    ...jest.requireActual<Record<string, unknown>>(
      '@openchoreo/openchoreo-client-node',
    ),
    createOpenChoreoApiClient: jest.fn(() => {
      if (!activeClient) {
        throw new Error(
          'createMockClient() must be called before the provider runs',
        );
      }
      return activeClient;
    }),
  };
}

/**
 * `jest.mock` factory for '@openchoreo/backstage-plugin-catalog-backend-module'.
 * The translators echo the source resource name into minimal
 * `{ kind, metadata: { name } }` entities so traversal tests can assert on
 * kinds and names without depending on the real translation rules.
 */
export function mockCatalogBackendModule() {
  return {
    translateNamespaceToDomainEntity: jest.fn(
      (namespace: { name: string }) => ({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Domain',
        metadata: { name: namespace.name },
      }),
    ),
    translateProjectToEntity: jest.fn((project: { name: string }) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: { name: project.name },
    })),
    translateComponentToEntity: jest.fn((component: { name: string }) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: component.name },
    })),
  };
}

function k8sMeta(name: string) {
  return {
    name,
    namespace: 'test-namespace',
    uid: `uid-${name}`,
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: {},
    annotations: {
      'openchoreo.dev/display-name': name,
      'openchoreo.dev/description': `${name} description`,
    },
  };
}

const readyCondition = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

/** Builds a K8s-style Namespace fixture. */
export function mockNamespace(
  name: string,
  overrides: DeepPartial<NewNamespace> = {},
): NewNamespace {
  return {
    ...overrides,
    metadata: { ...k8sMeta(name), ...overrides.metadata },
    status: { phase: 'Active', ...overrides.status },
  } as NewNamespace;
}

/** Builds a K8s-style Project fixture. */
export function mockProject(
  name: string,
  overrides: DeepPartial<NewProject> = {},
): NewProject {
  return {
    ...overrides,
    metadata: { ...k8sMeta(name), ...overrides.metadata },
    spec: {
      deploymentPipelineRef: { kind: 'DeploymentPipeline', name: 'default' },
      type: { kind: 'ProjectType', name: 'default' },
      ...overrides.spec,
    },
  } as NewProject;
}

/**
 * Builds a K8s-style Component fixture. The default spec attributes the
 * component to the project `${name}-project`; override
 * `spec.owner.projectName` (or pass `spec.owner: {}` to exercise the
 * namespace fallback).
 */
export function mockComponent(
  name: string,
  overrides: DeepPartial<NewComponent> = {},
): NewComponent {
  return {
    ...overrides,
    metadata: { ...k8sMeta(name), ...overrides.metadata },
    spec: {
      owner: { projectName: `${name}-project` },
      componentType: { kind: 'ComponentType', name: 'deployment/service' },
      autoDeploy: false,
      ...overrides.spec,
    },
    status: { conditions: [readyCondition], ...overrides.status },
  } as NewComponent;
}
