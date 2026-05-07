import { renderHook, act } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { ResponseError } from '@backstage/errors';
import { useSecrets } from './useSecrets';
import {
  openChoreoClientApiRef,
  Secret,
  SecretsListResponse,
} from '../../../api/OpenChoreoClientApi';

const mockClient = {
  listSecrets: jest.fn<Promise<SecretsListResponse>, [string]>(),
  createSecret: jest.fn(),
  deleteSecret: jest.fn(),
};

function makeSecret(name: string): Secret {
  return {
    name,
    namespace: 'ns',
    secretType: 'Opaque',
    targetPlane: { kind: 'DataPlane', name: 'dp-prod' },
    keys: ['k1'],
  } as Secret;
}

function renderUseSecrets(namespace: string) {
  return renderHook(() => useSecrets(namespace), {
    wrapper: ({ children }) => (
      <TestApiProvider apis={[[openChoreoClientApiRef, mockClient as any]]}>
        {children}
      </TestApiProvider>
    ),
  });
}

describe('useSecrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.listSecrets.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
    });
    mockClient.createSecret.mockResolvedValue(makeSecret('new'));
    mockClient.deleteSecret.mockResolvedValue(undefined);
  });

  it('fetches secrets on mount and exposes them', async () => {
    const items = [makeSecret('a'), makeSecret('b')];
    mockClient.listSecrets.mockResolvedValueOnce({
      items,
      totalCount: 2,
      page: 1,
      pageSize: 100,
    });

    const { result } = renderUseSecrets('ns');

    await act(async () => {});

    expect(mockClient.listSecrets).toHaveBeenCalledWith('ns');
    expect(result.current.secrets).toEqual(items);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isForbidden).toBe(false);
  });

  it('clears secrets when namespace is empty (does not fetch)', async () => {
    const { result } = renderUseSecrets('');

    await act(async () => {});

    expect(mockClient.listSecrets).not.toHaveBeenCalled();
    expect(result.current.secrets).toEqual([]);
  });

  it('captures errors and clears items on failed fetch', async () => {
    mockClient.listSecrets.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderUseSecrets('ns');

    await act(async () => {});

    expect(result.current.error?.message).toBe('boom');
    expect(result.current.secrets).toEqual([]);
    expect(result.current.isForbidden).toBe(false);
  });

  it('flags forbidden errors via isForbidden', async () => {
    const forbidden = await ResponseError.fromResponse(
      new Response(
        JSON.stringify({
          error: { name: 'ForbiddenError', message: 'no' },
        }),
        { status: 403, statusText: 'Forbidden' },
      ),
    );
    mockClient.listSecrets.mockRejectedValueOnce(forbidden);

    const { result } = renderUseSecrets('ns');

    await act(async () => {});

    expect(result.current.isForbidden).toBe(true);
  });

  it('createSecret calls the client and refetches', async () => {
    const created = makeSecret('new');
    mockClient.createSecret.mockResolvedValueOnce(created);
    mockClient.listSecrets.mockResolvedValueOnce({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
    });
    mockClient.listSecrets.mockResolvedValueOnce({
      items: [created],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });

    const { result } = renderUseSecrets('ns');
    await act(async () => {});

    let returned: Secret | undefined;
    await act(async () => {
      returned = await result.current.createSecret({
        secretName: 'new',
        secretType: 'Opaque',
        targetPlane: { kind: 'DataPlane', name: 'dp' },
        data: { k: 'v' },
      });
    });

    expect(mockClient.createSecret).toHaveBeenCalledWith('ns', {
      secretName: 'new',
      secretType: 'Opaque',
      targetPlane: { kind: 'DataPlane', name: 'dp' },
      data: { k: 'v' },
    });
    expect(returned).toEqual(created);
    expect(mockClient.listSecrets).toHaveBeenCalledTimes(2);
    expect(result.current.secrets).toEqual([created]);
  });

  it('deleteSecret calls the client and refetches', async () => {
    const initial = makeSecret('victim');
    mockClient.listSecrets.mockResolvedValueOnce({
      items: [initial],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });
    mockClient.listSecrets.mockResolvedValueOnce({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
    });

    const { result } = renderUseSecrets('ns');
    await act(async () => {});

    expect(result.current.secrets).toEqual([initial]);

    await act(async () => {
      await result.current.deleteSecret('victim');
    });

    expect(mockClient.deleteSecret).toHaveBeenCalledWith('ns', 'victim');
    expect(mockClient.listSecrets).toHaveBeenCalledTimes(2);
    expect(result.current.secrets).toEqual([]);
  });

  it('wraps non-Error rejection values in an Error', async () => {
    mockClient.listSecrets.mockRejectedValueOnce('not-an-error');

    const { result } = renderUseSecrets('ns');
    await act(async () => {});

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch secrets');
  });
});
