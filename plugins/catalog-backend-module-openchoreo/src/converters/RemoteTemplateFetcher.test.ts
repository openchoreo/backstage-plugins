import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { RemoteTemplateFetcher } from './RemoteTemplateFetcher';

const mockLogger: LoggerService = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(function child(this: LoggerService) {
    return this;
  }),
};

/** UrlReader stub whose readUrl resolves the given body or rejects. */
function readerFor(body: string | Error): UrlReaderService {
  return {
    readUrl: jest.fn(async () => {
      if (body instanceof Error) throw body;
      return { buffer: async () => Buffer.from(body, 'utf-8') };
    }),
    readTree: jest.fn(),
    search: jest.fn(),
  } as unknown as UrlReaderService;
}

const VALID_TEMPLATE = `
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: my-custom-template
  title: My Custom Template
spec:
  owner: guests
  type: Component
  steps: []
`;

const URL = 'https://github.com/acme/templates/blob/main/template.yaml';

describe('RemoteTemplateFetcher', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches, parses and stamps a valid Template', async () => {
    const fetcher = new RemoteTemplateFetcher(
      readerFor(VALID_TEMPLATE),
      mockLogger,
    );

    const entity = await fetcher.fetch(URL, {
      ctdName: 'agent-sandbox',
      namespace: 'my-ns',
      workloadType: 'deployment',
      displayName: 'Agent Sandbox',
    });

    expect(entity.kind).toBe('Template');
    expect(entity.metadata.name).toBe('my-custom-template');
    // Defaulted from ctx because the authored template omits a namespace.
    expect(entity.metadata.namespace).toBe('my-ns');

    const ann = entity.metadata.annotations!;
    expect(ann[CHOREO_ANNOTATIONS.CTD_NAME]).toBe('agent-sandbox');
    expect(ann[CHOREO_ANNOTATIONS.CTD_GENERATED]).toBe('false');
    expect(ann[CHOREO_ANNOTATIONS.SCAFFOLD_TEMPLATE_URL]).toBe(URL);
    expect(ann[CHOREO_ANNOTATIONS.WORKLOAD_TYPE]).toBe('deployment');
    expect(ann[CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME]).toBe('Agent Sandbox');
    // Anchor relative fetch:* steps at the source URL.
    expect(ann['backstage.io/managed-by-location']).toBe(`url:${URL}`);
    expect(ann['backstage.io/managed-by-origin-location']).toBe(`url:${URL}`);
    // No cluster kind for a namespaced type.
    expect(ann[CHOREO_ANNOTATIONS.CTD_KIND]).toBeUndefined();
  });

  it('stamps CTD_KIND for cluster-scoped types', async () => {
    const fetcher = new RemoteTemplateFetcher(
      readerFor(VALID_TEMPLATE),
      mockLogger,
    );

    const entity = await fetcher.fetch(URL, {
      ctdName: 'cluster-agent',
      namespace: 'openchoreo-cluster',
      ctdKind: 'ClusterComponentType',
    });

    expect(entity.metadata.annotations![CHOREO_ANNOTATIONS.CTD_KIND]).toBe(
      'ClusterComponentType',
    );
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
  });

  it('does not override a namespace declared by the authored template', async () => {
    const withNamespace = VALID_TEMPLATE.replace(
      'name: my-custom-template',
      'name: my-custom-template\n  namespace: authored-ns',
    );
    const fetcher = new RemoteTemplateFetcher(
      readerFor(withNamespace),
      mockLogger,
    );

    const entity = await fetcher.fetch(URL, {
      ctdName: 'agent-sandbox',
      namespace: 'ctx-ns',
    });

    expect(entity.metadata.namespace).toBe('authored-ns');
  });

  it('picks the Template out of a multi-document YAML file', async () => {
    const multiDoc = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: not-a-template
---
${VALID_TEMPLATE}
`;
    const fetcher = new RemoteTemplateFetcher(readerFor(multiDoc), mockLogger);

    const entity = await fetcher.fetch(URL, {
      ctdName: 'agent-sandbox',
      namespace: 'my-ns',
    });

    expect(entity.kind).toBe('Template');
    expect(entity.metadata.name).toBe('my-custom-template');
  });

  it('throws when the URL cannot be read', async () => {
    const fetcher = new RemoteTemplateFetcher(
      readerFor(new Error('404 Not Found')),
      mockLogger,
    );

    await expect(
      fetcher.fetch(URL, { ctdName: 'x', namespace: 'my-ns' }),
    ).rejects.toThrow(/Unable to read scaffolder template/);
  });

  it('throws when no kind: Template document is present', async () => {
    const notATemplate = `
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: just-a-component
`;
    const fetcher = new RemoteTemplateFetcher(
      readerFor(notATemplate),
      mockLogger,
    );

    await expect(
      fetcher.fetch(URL, { ctdName: 'x', namespace: 'my-ns' }),
    ).rejects.toThrow(/No 'kind: Template' entity found/);
  });

  it('throws when the Template is missing metadata.name', async () => {
    const noName = `
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  title: Nameless
spec:
  owner: guests
  type: Component
`;
    const fetcher = new RemoteTemplateFetcher(readerFor(noName), mockLogger);

    await expect(
      fetcher.fetch(URL, { ctdName: 'x', namespace: 'my-ns' }),
    ).rejects.toThrow(/missing metadata.name/);
  });

  it('throws on invalid YAML', async () => {
    const fetcher = new RemoteTemplateFetcher(
      readerFor(': : : not valid : yaml : ['),
      mockLogger,
    );

    await expect(
      fetcher.fetch(URL, { ctdName: 'x', namespace: 'my-ns' }),
    ).rejects.toThrow();
  });
});
