import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useProjectWorkloadEndpoints } from './useProjectWorkloadEndpoints';

const component = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'orders',
    annotations: { 'openchoreo.io/component': 'orders' },
  },
};

const catalogApi = {
  getEntities: jest.fn().mockResolvedValue({ items: [component] }),
};

const client = {
  fetchWorkloadInfo: jest.fn((_entity: unknown, releaseLine?: string) =>
    Promise.resolve({
      spec: {
        endpoints: releaseLine
          ? { api: {}, preview: {} }
          : { api: { visibility: ['external'] } },
      },
    }),
  ),
  fetchReleaseLines: jest
    .fn()
    .mockResolvedValue([{ name: 'main', isMain: true }, { name: 'next' }]),
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <TestApiProvider
    apis={[
      [catalogApiRef, catalogApi as any],
      [openChoreoClientApiRef, client as any],
    ]}
  >
    {children}
  </TestApiProvider>
);

describe('useProjectWorkloadEndpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists only the main lines' workload endpoints by default", async () => {
    const { result } = renderHook(
      () => useProjectWorkloadEndpoints('acme', 'store'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(
      result.current.options.map(o => [o.releaseLine, o.endpoint]),
    ).toEqual([[undefined, 'api']]);
    expect(client.fetchReleaseLines).not.toHaveBeenCalled();
  });

  it("adds each release line's workload endpoints, marked with the line", async () => {
    const { result } = renderHook(
      () =>
        useProjectWorkloadEndpoints('acme', 'store', {
          includeReleaseLines: true,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.options).toHaveLength(3));

    expect(
      result.current.options.map(o => [o.releaseLine, o.endpoint]),
    ).toEqual([
      [undefined, 'api'],
      ['next', 'api'],
      ['next', 'preview'],
    ]);
    // The main line is read once, not again as a release line.
    expect(client.fetchWorkloadInfo).toHaveBeenCalledTimes(2);
    expect(client.fetchWorkloadInfo).toHaveBeenCalledWith(component, 'next');
  });
  it("keeps the main line's endpoints when the release lines can't be read", async () => {
    client.fetchReleaseLines.mockRejectedValueOnce(new Error('forbidden'));
    const { result } = renderHook(
      () =>
        useProjectWorkloadEndpoints('acme', 'store', {
          includeReleaseLines: true,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(
      result.current.options.map(o => [o.releaseLine, o.endpoint]),
    ).toEqual([[undefined, 'api']]);
    expect(result.current.error).toBeUndefined();
  });
});
