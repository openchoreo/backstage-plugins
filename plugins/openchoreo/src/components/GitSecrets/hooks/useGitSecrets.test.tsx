import { renderHook, act } from '@testing-library/react';
import { useGitSecrets } from './useGitSecrets';

// ---- Mocks ----

const mockClient = {
  listGitSecrets: jest.fn(),
  createGitSecret: jest.fn(),
  deleteGitSecret: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockClient,
}));

// ---- Tests ----

describe('useGitSecrets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.listGitSecrets.mockResolvedValue({ items: [] });
  });

  it('fetches secrets on mount', async () => {
    renderHook(() => useGitSecrets('test-ns'));

    await act(async () => {});

    expect(mockClient.listGitSecrets).toHaveBeenCalledWith('test-ns');
  });

  it('returns secrets from the API', async () => {
    const items = [
      { name: 'secret-1', namespace: 'test-ns' },
      { name: 'secret-2', namespace: 'test-ns' },
    ];
    mockClient.listGitSecrets.mockResolvedValue({ items });

    const { result } = renderHook(() => useGitSecrets('test-ns'));

    await act(async () => {});

    expect(result.current.secrets).toEqual(items);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading to true while fetching', () => {
    mockClient.listGitSecrets.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useGitSecrets('test-ns'));

    expect(result.current.loading).toBe(true);
  });

  it('sets error when fetch fails', async () => {
    mockClient.listGitSecrets.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGitSecrets('test-ns'));

    await act(async () => {});

    expect(result.current.error).toEqual(new Error('Network error'));
    expect(result.current.secrets).toEqual([]);
  });

  it('returns empty secrets when namespace is empty', () => {
    const { result } = renderHook(() => useGitSecrets(''));

    expect(result.current.secrets).toEqual([]);
    expect(mockClient.listGitSecrets).not.toHaveBeenCalled();
  });

  it('creates a secret and refreshes the list', async () => {
    const newSecret = { name: 'new-secret', namespace: 'test-ns' };
    mockClient.createGitSecret.mockResolvedValue(newSecret);
    mockClient.listGitSecrets.mockResolvedValue({
      items: [newSecret],
    });

    const { result } = renderHook(() => useGitSecrets('test-ns'));

    await act(async () => {});

    await act(async () => {
      const created = await result.current.createSecret(
        'new-secret',
        'basic-auth',
        'token123',
        'user',
      );
      expect(created).toEqual(newSecret);
    });

    expect(mockClient.createGitSecret).toHaveBeenCalledWith(
      'test-ns',
      'new-secret',
      'basic-auth',
      'token123',
      'user',
      undefined,
      undefined,
      undefined,
    );
  });

  it('deletes a secret and refreshes the list', async () => {
    mockClient.deleteGitSecret.mockResolvedValue(undefined);
    mockClient.listGitSecrets
      .mockResolvedValueOnce({
        items: [{ name: 'to-delete', namespace: 'test-ns' }],
      })
      .mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(() => useGitSecrets('test-ns'));

    await act(async () => {});

    await act(async () => {
      await result.current.deleteSecret('to-delete');
    });

    expect(mockClient.deleteGitSecret).toHaveBeenCalledWith(
      'test-ns',
      'to-delete',
    );
  });

  it('refetches secrets when namespace changes', async () => {
    mockClient.listGitSecrets.mockResolvedValue({ items: [] });

    const { rerender } = renderHook(
      ({ ns }) => useGitSecrets(ns),
      { initialProps: { ns: 'ns-a' } },
    );

    await act(async () => {});

    expect(mockClient.listGitSecrets).toHaveBeenCalledWith('ns-a');

    rerender({ ns: 'ns-b' });

    await act(async () => {});

    expect(mockClient.listGitSecrets).toHaveBeenCalledWith('ns-b');
  });

  it('sets isForbidden to false for non-403 errors', async () => {
    mockClient.listGitSecrets.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useGitSecrets('test-ns'));

    await act(async () => {});

    expect(result.current.isForbidden).toBe(false);
  });
});
