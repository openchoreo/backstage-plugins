declare module 'sync-fetch' {
  interface SyncResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: {
      get(name: string): string | null;
    };
    json<T = unknown>(): T;
    text(): string;
    buffer(): Buffer;
  }

  function syncFetch(url: string, options?: RequestInit): SyncResponse;

  export default syncFetch;
}
