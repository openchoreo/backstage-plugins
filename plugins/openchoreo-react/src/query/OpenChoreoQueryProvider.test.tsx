import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { identityApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/test-utils';
import {
  OpenChoreoQueryProvider,
  useUserScopedKey,
} from './OpenChoreoQueryProvider';

function identity(userEntityRef: string) {
  return {
    getBackstageIdentity: jest.fn().mockResolvedValue({ userEntityRef }),
  };
}

function wrapperFor(
  api: Partial<import('@backstage/core-plugin-api').IdentityApi>,
) {
  return ({ children }: { children: React.ReactNode }) => (
    <TestApiProvider apis={[[identityApiRef, api]]}>
      <OpenChoreoQueryProvider>{children}</OpenChoreoQueryProvider>
    </TestApiProvider>
  );
}

describe('OpenChoreoQueryProvider', () => {
  it('renders its children (so a QueryClient is in the tree for them)', async () => {
    render(
      <TestApiProvider
        apis={[[identityApiRef, identity('user:default/alice')]]}
      >
        <OpenChoreoQueryProvider>
          <div data-testid="child">hello</div>
        </OpenChoreoQueryProvider>
      </TestApiProvider>,
    );
    expect(await screen.findByTestId('child')).toHaveTextContent('hello');
  });
});

describe('useUserScopedKey', () => {
  it('namespaces the key under a pending sentinel before the user resolves', () => {
    // A never-resolving identity keeps the scope in its pre-resolution state.
    const api = {
      getBackstageIdentity: jest.fn(() => new Promise<never>(() => {})),
    };
    const { result } = renderHook(() => useUserScopedKey(), {
      wrapper: wrapperFor(api),
    });
    const key = result.current(['components', 'c1']);
    // Prefixed and namespaced, but NOT under any real user's scope.
    expect(key[0]).toBe('@user');
    expect(key[1]).toBe('@openchoreo/pending-user');
    expect(key.slice(2)).toEqual(['components', 'c1']);
  });

  it('namespaces the key under the signed-in user once resolved', async () => {
    const { result } = renderHook(() => useUserScopedKey(), {
      wrapper: wrapperFor(identity('user:default/alice')),
    });
    await waitFor(() =>
      expect(result.current(['components'])).toEqual([
        '@user',
        'user:default/alice',
        'components',
      ]),
    );
  });

  it('gives different users disjoint key spaces (structural isolation)', async () => {
    const aliceHook = renderHook(() => useUserScopedKey(), {
      wrapper: wrapperFor(identity('user:default/alice')),
    });
    const bobHook = renderHook(() => useUserScopedKey(), {
      wrapper: wrapperFor(identity('user:default/bob')),
    });

    await waitFor(() =>
      expect(aliceHook.result.current(['x'])[1]).toBe('user:default/alice'),
    );
    await waitFor(() =>
      expect(bobHook.result.current(['x'])[1]).toBe('user:default/bob'),
    );

    // Same caller key → different namespaced keys → cannot collide in the cache.
    expect(aliceHook.result.current(['x'])).not.toEqual(
      bobHook.result.current(['x']),
    );
  });

  it('returns a stable function per user (safe as a memo/effect dep)', async () => {
    const { result, rerender } = renderHook(() => useUserScopedKey(), {
      wrapper: wrapperFor(identity('user:default/alice')),
    });
    await waitFor(() =>
      expect(result.current(['x'])[1]).toBe('user:default/alice'),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
