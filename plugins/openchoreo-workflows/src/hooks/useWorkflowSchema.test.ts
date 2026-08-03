import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { genericWorkflowsClientApiRef } from '../api';
import { useWorkflowSchema } from './useWorkflowSchema';

jest.mock('../context', () => ({
  useSelectedNamespace: () => 'ns-a',
}));

const SCHEMA = { type: 'object', properties: { image: { type: 'string' } } };

function renderUseWorkflowSchema(client: any) {
  return renderHook(() => useWorkflowSchema('build'), {
    wrapper: createQueryWrapper([[genericWorkflowsClientApiRef, client]]),
  });
}

describe('useWorkflowSchema', () => {
  it('starts loading with a null schema, then resolves the namespace-scoped schema', async () => {
    const client = {
      getWorkflowSchema: jest.fn().mockResolvedValue(SCHEMA),
    };
    const { result } = renderUseWorkflowSchema(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.schema).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.schema).toEqual(SCHEMA);
    expect(result.current.error).toBeNull();
    expect(client.getWorkflowSchema).toHaveBeenCalledWith('ns-a', 'build');
  });

  it('exposes isRefetching, which is false once the initial load settles', async () => {
    const client = {
      getWorkflowSchema: jest.fn().mockResolvedValue(SCHEMA),
    };
    const { result } = renderUseWorkflowSchema(client);

    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRefetching).toBe(false);
  });
});
