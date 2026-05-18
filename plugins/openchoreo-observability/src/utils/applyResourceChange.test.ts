// structuredClone is not available in all test environments
if (typeof structuredClone === 'undefined') {
  (global as any).structuredClone = <T>(obj: T): T =>
    JSON.parse(JSON.stringify(obj));
}

import {
  applyJsonPointer,
  applyEnvChange,
  applyFileChange,
  applyResourceChange,
} from './applyResourceChange';

// ---------------------------------------------------------------------------
// applyJsonPointer
// ---------------------------------------------------------------------------

describe('applyJsonPointer', () => {
  it('sets a value at a valid spec/componentTypeEnvironmentConfigs pointer', () => {
    const doc: any = {};
    applyJsonPointer(
      doc,
      '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
      '50m',
    );
    expect(
      doc.spec.componentTypeEnvironmentConfigs.resources.requests.cpu,
    ).toBe('50m');
  });

  it('sets a value at a valid spec/workloadOverrides pointer', () => {
    const doc: any = {};
    applyJsonPointer(doc, '/spec/workloadOverrides/container/replicas', 2);
    expect(doc.spec.workloadOverrides.container.replicas).toBe(2);
  });

  it('sets a value at a valid spec/traitEnvironmentConfigs pointer', () => {
    const doc: any = {};
    applyJsonPointer(doc, '/spec/traitEnvironmentConfigs/my-trait/timeout', 30);
    expect(doc.spec.traitEnvironmentConfigs['my-trait'].timeout).toBe(30);
  });

  it('overwrites an existing value', () => {
    const doc: any = {
      spec: {
        componentTypeEnvironmentConfigs: {
          resources: { requests: { cpu: '200m' } },
        },
      },
    };
    applyJsonPointer(
      doc,
      '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
      '50m',
    );
    expect(
      doc.spec.componentTypeEnvironmentConfigs.resources.requests.cpu,
    ).toBe('50m');
  });

  it('initialises null intermediate nodes to objects', () => {
    const doc: any = { spec: { componentTypeEnvironmentConfigs: null } };
    applyJsonPointer(
      doc,
      '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
      '10m',
    );
    expect(
      doc.spec.componentTypeEnvironmentConfigs.resources.requests.cpu,
    ).toBe('10m');
  });

  it('throws for pointer with fewer than 3 segments', () => {
    expect(() =>
      applyJsonPointer({}, '/spec/componentTypeEnvironmentConfigs', 'x'),
    ).toThrow('Invalid pointer');
  });

  it('throws for pointer not starting with /spec/', () => {
    expect(() => applyJsonPointer({}, '/metadata/name/foo', 'x')).toThrow(
      'Invalid pointer',
    );
  });

  it('throws for pointer with a disallowed spec category', () => {
    expect(() => applyJsonPointer({}, '/spec/containers/0/image', 'x')).toThrow(
      'Invalid pointer',
    );
  });
});

// ---------------------------------------------------------------------------
// applyEnvChange
// ---------------------------------------------------------------------------

describe('applyEnvChange', () => {
  it('adds a new env var when the key does not exist', () => {
    const doc: any = {};
    applyEnvChange(doc, 'FOO', 'bar');
    expect(doc.spec.workloadOverrides.container.env).toEqual([
      { key: 'FOO', value: 'bar' },
    ]);
  });

  it('updates an existing env var', () => {
    const doc: any = {
      spec: {
        workloadOverrides: {
          container: {
            env: [{ key: 'FOO', value: 'old' }],
          },
        },
      },
    };
    applyEnvChange(doc, 'FOO', 'new');
    expect(doc.spec.workloadOverrides.container.env).toEqual([
      { key: 'FOO', value: 'new' },
    ]);
  });

  it('appends without touching unrelated env vars', () => {
    const doc: any = {
      spec: {
        workloadOverrides: { container: { env: [{ key: 'A', value: '1' }] } },
      },
    };
    applyEnvChange(doc, 'B', '2');
    expect(doc.spec.workloadOverrides.container.env).toHaveLength(2);
    expect(doc.spec.workloadOverrides.container.env[1]).toEqual({
      key: 'B',
      value: '2',
    });
  });
});

// ---------------------------------------------------------------------------
// applyFileChange
// ---------------------------------------------------------------------------

describe('applyFileChange', () => {
  it('updates value of an existing file mount', () => {
    const doc: any = {
      spec: {
        workloadOverrides: {
          container: {
            files: [
              { key: 'config.yaml', mountPath: '/etc/app', value: 'old' },
            ],
          },
        },
      },
    };
    applyFileChange(doc, 'config.yaml', '/etc/app', 'new');
    expect(doc.spec.workloadOverrides.container.files[0].value).toBe('new');
  });

  it('throws when the mount is not found', () => {
    const doc: any = {
      spec: { workloadOverrides: { container: { files: [] } } },
    };
    expect(() => applyFileChange(doc, 'missing.yaml', '/etc/app', 'v')).toThrow(
      "File mount 'missing.yaml'",
    );
  });

  it('throws when key matches but mountPath differs', () => {
    const doc: any = {
      spec: {
        workloadOverrides: {
          container: {
            files: [{ key: 'config.yaml', mountPath: '/etc/a', value: 'v' }],
          },
        },
      },
    };
    expect(() => applyFileChange(doc, 'config.yaml', '/etc/b', 'new')).toThrow(
      "File mount 'config.yaml'",
    );
  });
});

// ---------------------------------------------------------------------------
// applyResourceChange (integration: GET → mutate → PUT)
// ---------------------------------------------------------------------------

describe('applyResourceChange', () => {
  const mockFetchApi = { fetch: jest.fn() };
  const baseUrl = 'http://backend';
  const namespaceName = 'dev';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makeGetResponse(data: object) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    } as Response);
  }

  function makePutResponse(ok = true) {
    return Promise.resolve({
      ok,
      statusText: ok ? 'OK' : 'Internal Server Error',
    } as Response);
  }

  it('GETs, applies field changes, and PUTs the updated binding', async () => {
    const binding = {
      metadata: { name: 'my-binding' },
      spec: {},
    };
    mockFetchApi.fetch
      .mockResolvedValueOnce(makeGetResponse(binding))
      .mockResolvedValueOnce(makePutResponse());

    await applyResourceChange({
      backendBaseUrl: baseUrl,
      fetchApi: mockFetchApi as any,
      namespaceName,
      change: {
        release_binding: 'my-binding',
        fields: [
          {
            json_pointer:
              '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
            value: '50m',
          },
          {
            json_pointer:
              '/spec/componentTypeEnvironmentConfigs/resources/requests/memory',
            value: '128Mi',
          },
        ],
      },
    });

    // GET called with correct URL
    expect(mockFetchApi.fetch).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/release-binding?namespaceName=dev&bindingName=my-binding`,
    );

    // PUT called with mutated spec
    const [putUrl, putOpts] = mockFetchApi.fetch.mock.calls[1];
    expect(putUrl).toBe(
      `${baseUrl}/release-binding?namespaceName=dev&bindingName=my-binding`,
    );
    expect(putOpts.method).toBe('PUT');
    const body = JSON.parse(putOpts.body);
    expect(
      body.spec.componentTypeEnvironmentConfigs.resources.requests.cpu,
    ).toBe('50m');
    expect(
      body.spec.componentTypeEnvironmentConfigs.resources.requests.memory,
    ).toBe('128Mi');
  });

  it('does not mutate the original binding object', async () => {
    const binding = { metadata: { name: 'b' }, spec: {} };
    mockFetchApi.fetch
      .mockResolvedValueOnce(makeGetResponse(binding))
      .mockResolvedValueOnce(makePutResponse());

    await applyResourceChange({
      backendBaseUrl: baseUrl,
      fetchApi: mockFetchApi as any,
      namespaceName,
      change: {
        release_binding: 'b',
        fields: [
          {
            json_pointer: '/spec/componentTypeEnvironmentConfigs/x',
            value: '1',
          },
        ],
      },
    });

    // original binding.spec is still empty
    expect(binding.spec).toEqual({});
  });

  it('throws with a 404 message when GET returns 404', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(
      applyResourceChange({
        backendBaseUrl: baseUrl,
        fetchApi: mockFetchApi as any,
        namespaceName,
        change: { release_binding: 'missing-binding' },
      }),
    ).rejects.toThrow("Release binding 'missing-binding' not found");
  });

  it('throws with a generic message on non-404 GET failure', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    await expect(
      applyResourceChange({
        backendBaseUrl: baseUrl,
        fetchApi: mockFetchApi as any,
        namespaceName,
        change: { release_binding: 'b' },
      }),
    ).rejects.toThrow('Failed to get release binding: Internal Server Error');
  });

  it('throws when PUT fails', async () => {
    const binding = { metadata: {}, spec: {} };
    mockFetchApi.fetch
      .mockResolvedValueOnce(makeGetResponse(binding))
      .mockResolvedValueOnce(makePutResponse(false));

    await expect(
      applyResourceChange({
        backendBaseUrl: baseUrl,
        fetchApi: mockFetchApi as any,
        namespaceName,
        change: { release_binding: 'b' },
      }),
    ).rejects.toThrow('Failed to update release binding');
  });

  it('URL-encodes namespace and binding name', async () => {
    mockFetchApi.fetch
      .mockResolvedValueOnce(makeGetResponse({ metadata: {}, spec: {} }))
      .mockResolvedValueOnce(makePutResponse());

    await applyResourceChange({
      backendBaseUrl: baseUrl,
      fetchApi: mockFetchApi as any,
      namespaceName: 'my namespace',
      change: { release_binding: 'my binding' },
    });

    const getUrl = mockFetchApi.fetch.mock.calls[0][0] as string;
    expect(getUrl).toContain('namespaceName=my%20namespace');
    expect(getUrl).toContain('bindingName=my%20binding');
  });
});
