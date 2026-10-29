import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useAutoDeploy } from './useAutoDeploy';

let mockReleaseLine: string | undefined;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useReleaseLine: () => ({ releaseLine: mockReleaseLine }),
}));

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'checkout', namespace: 'default' },
};

function renderUseAutoDeploy(getComponentDetails: jest.Mock) {
  const client = { getComponentDetails } as any;
  return renderHook(() => useAutoDeploy(entity), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useAutoDeploy', () => {
  beforeEach(() => {
    mockReleaseLine = undefined;
  });

  it('starts loading with defaults before component details resolve', () => {
    const { result } = renderUseAutoDeploy(
      jest.fn().mockReturnValue(new Promise(() => {})),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.autoDeploy).toBe(false);
    expect(result.current.latestReleaseName).toBeNull();
    expect(result.current.componentError).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('maps component details onto the auto-deploy state', async () => {
    const getComponentDetails = jest.fn().mockResolvedValue({
      autoDeploy: true,
      latestRelease: { name: 'release-42' },
      hasError: true,
      errorReason: 'InvalidTrait',
      errorMessage: 'bad config',
    });
    const { result } = renderUseAutoDeploy(getComponentDetails);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.autoDeploy).toBe(true);
    expect(result.current.latestReleaseName).toBe('release-42');
    expect(result.current.componentError).toEqual({
      reason: 'InvalidTrait',
      message: 'bad config',
    });
    expect(result.current.isRefetching).toBe(false);
  });

  it('setAutoDeployOptimistic flips the cached toggle immediately', async () => {
    const getComponentDetails = jest.fn().mockResolvedValue({
      autoDeploy: false,
      latestRelease: null,
      hasError: false,
    });
    const { result } = renderUseAutoDeploy(getComponentDetails);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.autoDeploy).toBe(false);

    act(() => {
      result.current.setAutoDeployOptimistic(true);
    });

    await waitFor(() => expect(result.current.autoDeploy).toBe(true));
  });

  it.each([
    [undefined, true],
    [false, false],
  ])(
    'on a release line with override %s, auto deploy is %s',
    async (override, expected) => {
      mockReleaseLine = 'next';
      const client = {
        getComponentDetails: jest.fn().mockResolvedValue({
          autoDeploy: true,
          latestRelease: { name: 'component-release' },
        }),
        fetchReleaseLines: jest.fn().mockResolvedValue([
          {
            name: 'next',
            latestRelease: 'hello-next-1',
            environments: [],
            autoDeploy: override,
          },
        ]),
      } as any;
      const { result } = renderHook(() => useAutoDeploy(entity), {
        wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.autoDeploy).toBe(expected);
      expect(result.current.latestReleaseName).toBe('hello-next-1');
    },
  );
});
