import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useDimensionTitles } from './useDimensionTitles';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

describe('useDimensionTitles', () => {
  const getEntities = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getEntities });
  });

  it('maps System names to titles at the namespace level', async () => {
    getEntities.mockResolvedValueOnce({
      items: [
        { metadata: { name: 'gcp', title: 'GCP Demo' } },
        { metadata: { name: 'shop' } }, // no title, so absent from the map
      ],
    });

    const { result } = renderHook(
      () => useDimensionTitles('namespace', { namespace: 'default' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current).toEqual({ gcp: 'GCP Demo' }));
    expect(getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: 'System', 'metadata.namespace': 'default' },
      }),
    );
  });

  it('filters Components by namespace + project annotations at the project level', async () => {
    getEntities.mockResolvedValueOnce({
      items: [
        {
          metadata: {
            name: 'api',
            title: 'API Service',
            annotations: {
              'openchoreo.io/namespace': 'default',
              'openchoreo.io/project': 'gcp',
            },
          },
        },
        {
          metadata: {
            name: 'other',
            title: 'Other',
            annotations: {
              'openchoreo.io/namespace': 'default',
              'openchoreo.io/project': 'shop',
            },
          },
        },
      ],
    });

    const { result } = renderHook(
      () =>
        useDimensionTitles('project', { namespace: 'default', project: 'gcp' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current).toEqual({ api: 'API Service' }));
    // Components are namespace/project-scoped via annotations in the filter.
    expect(getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          kind: 'Component',
          'metadata.annotations.openchoreo.io/namespace': 'default',
          'metadata.annotations.openchoreo.io/project': 'gcp',
        },
      }),
    );
  });

  it('returns an empty map without a namespace', async () => {
    const { result } = renderHook(() => useDimensionTitles('namespace', {}), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(getEntities).not.toHaveBeenCalled());
    expect(result.current).toEqual({});
  });
});
