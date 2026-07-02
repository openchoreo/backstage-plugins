// jsdom 16 (which backstage-cli uses for unit tests) does not expose
// TextEncoder/TextDecoder on globalThis, but the hook under test relies on
// `new TextDecoder()` to parse SSE bytes. Patch the globals before importing.
// `util` is normally a restricted import per Backstage's eslint preset, but
// it's the only way to reach Node's built-in encoders inside this test env.
// eslint-disable-next-line no-restricted-imports
const nodeUtil = require('util');

if (typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = nodeUtil.TextEncoder;
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = nodeUtil.TextDecoder;
}

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { useWirelogsStream } from './useWirelogsStream';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

const encoder = new (globalThis as any).TextEncoder();

function makeReader(chunks: Array<string | Uint8Array>) {
  let i = 0;
  return {
    read: jest.fn(async () => {
      if (i >= chunks.length) {
        return { value: undefined, done: true } as const;
      }
      const chunk = chunks[i++];
      const value = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
      return { value, done: false } as const;
    }),
  };
}

function streamingResponse(chunks: Array<string | Uint8Array>): Response {
  const reader = makeReader(chunks);
  return {
    ok: true,
    body: { getReader: () => reader },
  } as unknown as Response;
}

function errorResponse(status: number, statusText: string, body = '') {
  return {
    ok: false,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function makeApis() {
  const getBaseUrl = jest
    .fn()
    .mockResolvedValue('http://backend/api/openchoreo');
  const fetch = jest.fn();
  (useApi as jest.Mock).mockImplementation(ref => {
    if (ref === discoveryApiRef) return { getBaseUrl };
    if (ref === fetchApiRef) return { fetch };
    return undefined;
  });
  return { getBaseUrl, fetch };
}

const args = {
  namespaceName: 'ns',
  projectName: 'proj',
  environmentName: 'dev',
};

describe('useWirelogsStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets error state when start is called without required identifiers', () => {
    makeApis();
    const { result } = renderHook(() =>
      useWirelogsStream({
        namespaceName: undefined,
        projectName: 'proj',
        environmentName: 'dev',
      }),
    );

    act(() => result.current.start());
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/required/);
  });

  it('streams SSE data frames into flows and surfaces error events', async () => {
    const { getBaseUrl, fetch } = makeApis();
    const chunks = [
      'data: {"flow":{"uuid":"a","verdict":"FORWARDED"}}\n\n',
      'data: {"flow":{"uuid":"b","verdict":"DROPPED"}}\n\nevent: error\ndata: {"message":"boom"}\n\n',
    ];
    fetch.mockResolvedValueOnce(streamingResponse(chunks));

    const { result } = renderHook(() => useWirelogsStream(args));

    act(() => result.current.start());

    await waitFor(() => expect(result.current.flows).toHaveLength(2));
    expect(result.current.totalReceived).toBe(2);
    // The error event was emitted between data frames; status flips to error
    // immediately, then the stream ends and the hook transitions to closed.
    await waitFor(() => expect(result.current.error).toBe('boom'));

    // URL params include the openchoreo discovery base + all required params.
    expect(getBaseUrl).toHaveBeenCalledWith('openchoreo');
    const calledUrl = fetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/wirelogs/stream');
    expect(calledUrl).toContain('namespaceName=ns');
    expect(calledUrl).toContain('projectName=proj');
    expect(calledUrl).toContain('environmentName=dev');
  });

  it('passes componentName when provided', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(streamingResponse([]));

    const { result } = renderHook(() =>
      useWirelogsStream({ ...args, componentName: 'svc' }),
    );

    act(() => result.current.start());

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls[0][0]).toContain('componentName=svc');
  });

  it('parses frames split across chunk boundaries', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(
      streamingResponse([
        'data: {"flow":{"uu',
        'id":"a"}}\n\ndata: {"flow":{"uuid":"b"}}\n\n',
      ]),
    );
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.flows).toHaveLength(2));
    expect(result.current.flows[0].flow.uuid).toBe('a');
    expect(result.current.flows[1].flow.uuid).toBe('b');
  });

  it('evicts older flows once the buffer cap is exceeded', async () => {
    const { fetch } = makeApis();
    const frames = Array.from(
      { length: 4 },
      (_, i) => `data: {"flow":{"uuid":"u${i}"}}\n\n`,
    ).join('');
    fetch.mockResolvedValueOnce(streamingResponse([frames]));

    const { result } = renderHook(() =>
      useWirelogsStream({ ...args, maxBuffer: 2 }),
    );

    act(() => result.current.start());

    await waitFor(() => expect(result.current.flows).toHaveLength(2));
    expect(result.current.flows.map(f => f.flow.uuid)).toEqual(['u2', 'u3']);
    // totalReceived counts every parsed frame, not just retained ones.
    expect(result.current.totalReceived).toBe(4);
  });

  it('drops malformed JSON and frames without flow', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(
      streamingResponse([
        'data: not-json\n\n',
        'data: {"noflow":true}\n\n',
        'data: {"flow":{"uuid":"ok"}}\n\n',
      ]),
    );
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.flows).toHaveLength(1));
    expect(result.current.flows[0].flow.uuid).toBe('ok');
    // Only the parseable flow frame counts towards totalReceived.
    expect(result.current.totalReceived).toBe(1);
  });

  it('transitions to closed when the stream ends naturally', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(streamingResponse([]));
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('closed'));
  });

  it('reports an error and leaves status=error when the upstream returns non-ok', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(errorResponse(503, 'Service Unavailable', ''));
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/503/);
  });

  it('surfaces the upstream body when one is provided', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(errorResponse(500, 'X', 'bad-thing'));
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('bad-thing');
  });

  it('errors when the response has no body', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce({
      ok: true,
      body: null,
    } as unknown as Response);
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/no body/);
  });

  it('clear resets flows, totalReceived and error', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(
      streamingResponse(['data: {"flow":{"uuid":"a"}}\n\n']),
    );
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.flows).toHaveLength(1));
    act(() => result.current.clear());
    expect(result.current.flows).toEqual([]);
    expect(result.current.totalReceived).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('stop aborts the in-flight stream and moves status to closed', async () => {
    const { fetch } = makeApis();
    fetch.mockImplementation(
      (_url, opts: any) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('connecting'));
    act(() => result.current.stop());
    expect(result.current.status).toBe('closed');
    expect(result.current.closedReason).toBe('user');
  });

  it('captures the hard timeout from a meta frame', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(
      streamingResponse([
        'event: meta\ndata: {"hardTimeoutMs":900000}\n\n',
        'data: {"flow":{"uuid":"a"}}\n\n',
      ]),
    );
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.hardTimeoutMs).toBe(900000));
  });

  it('marks closedReason=timeout when the server sends a timeout frame', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(
      streamingResponse(['event: timeout\ndata: {"message":"stopped"}\n\n']),
    );
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('closed'));
    // The trailing natural-end must not overwrite the timeout reason.
    expect(result.current.closedReason).toBe('timeout');
  });

  it('marks closedReason=ended when the stream ends naturally', async () => {
    const { fetch } = makeApis();
    fetch.mockResolvedValueOnce(streamingResponse([]));
    const { result } = renderHook(() => useWirelogsStream(args));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('closed'));
    expect(result.current.closedReason).toBe('ended');
  });
});
