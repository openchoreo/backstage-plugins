/**
 * Smoke test for the API factories registered in `apis.ts`.
 *
 * The render-the-whole-app test in App.test.tsx exercises most factories
 * indirectly, but the perch-agent factory is wired through a route
 * the smoke render never visits, so its body shows up as 0% covered on
 * the codecov diff. This file calls each factory directly with the
 * minimum dependency surface so the body is executed.
 *
 * We only assert "factory returned an instance" — full client behavior
 * is covered by each plugin's own tests.
 *
 * Under NFS, `openchoreo-ci`, `openchoreo-workflows`, and the
 * `catalog-graph` override own their API factories via `ApiBlueprint`
 * inside their `/alpha` plugins / `customOverrides.tsx`, so they are
 * NOT in this app-scoped `apis` array. Their factory bodies are covered
 * by the plugins' own tests.
 */
import {
  AnyApiFactory,
  fetchApiRef,
  storageApiRef,
} from '@backstage/core-plugin-api';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { visitsApiRef } from '@backstage/plugin-home';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import {
  perchAgentApiRef,
  PerchAgentClient,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';

import { apis } from './apis';
import { openChoreoAuthApiRef } from './apis/authRefs';

// Minimal stubs — none of the factories under test inspect dep state at
// construction time beyond holding the reference.
const stubDiscovery = { getBaseUrl: async () => 'http://localhost' } as any;
const stubFetch = { fetch: globalThis.fetch ?? (() => undefined) } as any;
const stubIdentity = {
  getCredentials: async () => ({}),
  getProfileInfo: async () => ({}),
  getBackstageIdentity: async () => ({}),
  signOut: async () => {},
} as any;
const stubError = { post: () => {}, error$: () => undefined } as any;

function findFactory(
  factories: AnyApiFactory[],
  ref: { id: string },
): AnyApiFactory {
  const f = factories.find(x => x.api.id === ref.id);
  if (!f) throw new Error(`factory not registered: ${ref.id}`);
  return f;
}

function invoke(factory: AnyApiFactory, deps: Record<string, unknown>) {
  // ``factory`` is an internal type — call its ``factory`` member with
  // the requested deps. The deps object is whatever ``factory.deps``
  // declares; we provide stubs keyed by the same names.
  return (factory as any).factory(deps);
}

describe('apis registry', () => {
  it('registers a factory for every required api ref (no silent drops)', () => {
    const ids = apis.map(f => f.api.id);
    for (const ref of [
      scmIntegrationsApiRef,
      permissionApiRef,
      fetchApiRef,
      openChoreoAuthApiRef,
      visitsApiRef,
      storageApiRef,
      perchAgentApiRef,
    ]) {
      expect(ids).toContain(ref.id);
    }
  });

  it('builds the PerchAgentClient via its factory', () => {
    const f = findFactory(apis, perchAgentApiRef);
    const instance = invoke(f, {
      discoveryApi: stubDiscovery,
      fetchApi: stubFetch,
    });
    expect(instance).toBeInstanceOf(PerchAgentClient);
  });

  it('builds the visits api', () => {
    const f = findFactory(apis, visitsApiRef);
    const instance = invoke(f, {
      identityApi: stubIdentity,
      errorApi: stubError,
    });
    expect(instance).toBeDefined();
  });
});
