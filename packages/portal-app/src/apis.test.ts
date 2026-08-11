/**
 * Smoke test for the API factories registered in `apis.ts`.
 *
 * OpenChoreo-specific fetch / permission / auth factories now ship from
 * `@openchoreo/backstage-plugin` as ApiBlueprints, so they're not in this
 * app-scoped `apis` array — covered by the plugin's own tests.
 */
import {
  AnyApiFactory,
  fetchApiRef,
  storageApiRef,
} from '@backstage/core-plugin-api';
import { visitsApiRef } from '@backstage/plugin-home';
import { scmIntegrationsApiRef } from '@backstage/integration-react';

import { apis } from './apis';

// Minimal stubs — none of the factories under test inspect dep state at
// construction time beyond holding the reference.
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
  return (factory as any).factory(deps);
}

describe('apis registry', () => {
  it('registers a factory for every required api ref (no silent drops)', () => {
    const ids = apis.map(f => f.api.id);
    for (const ref of [scmIntegrationsApiRef, visitsApiRef, storageApiRef]) {
      expect(ids).toContain(ref.id);
    }
  });

  it('does NOT register OC-specific fetch/permission/auth factories (base plugin owns them)', () => {
    const ids = apis.map(f => f.api.id);
    expect(ids).not.toContain(fetchApiRef.id);
    // permission and openchoreo-auth are also owned by the base plugin now
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
