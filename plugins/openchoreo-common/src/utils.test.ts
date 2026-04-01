import type { ModelsCompleteComponent } from './index';
import {
  getRepositoryInfo,
  getRepositoryUrl,
  sanitizeLabel,
  parseWorkflowParametersAnnotation,
  filterEmptyObjectProperties,
} from './utils';

function makeComponent(
  workflowParams?: Record<string, unknown>,
): ModelsCompleteComponent {
  return {
    uid: 'uid-1',
    name: 'test',
    type: 'deployment/service',
    projectName: 'proj',
    namespaceName: 'ns',
    createdAt: '2025-01-01T00:00:00Z',
    status: 'Ready',
    componentWorkflow: workflowParams
      ? { name: 'docker-build', parameters: workflowParams }
      : undefined,
  };
}

describe('getRepositoryInfo', () => {
  it('extracts url, branch, and path from workflow parameters', () => {
    const comp = makeComponent({
      repository: {
        url: 'https://github.com/org/repo.git',
        revision: { branch: 'main' },
        appPath: './services/api',
      },
    });
    expect(getRepositoryInfo(comp)).toEqual({
      url: 'https://github.com/org/repo.git',
      branch: 'main',
      path: './services/api',
    });
  });

  it('returns empty object when no workflow', () => {
    expect(getRepositoryInfo(makeComponent())).toEqual({});
  });

  it('returns empty object when no repository in parameters', () => {
    expect(getRepositoryInfo(makeComponent({ other: 'value' }))).toEqual({});
  });

  it('handles missing revision and appPath', () => {
    const comp = makeComponent({
      repository: { url: 'https://github.com/org/repo.git' },
    });
    const info = getRepositoryInfo(comp);
    expect(info.url).toBe('https://github.com/org/repo.git');
    expect(info.branch).toBeUndefined();
    expect(info.path).toBeUndefined();
  });
});

describe('getRepositoryUrl', () => {
  it('constructs full URL with branch and path', () => {
    const comp = makeComponent({
      repository: {
        url: 'https://github.com/org/repo',
        revision: { branch: 'main' },
        appPath: 'services/api',
      },
    });
    expect(getRepositoryUrl(comp)).toBe(
      'https://github.com/org/repo/tree/main/services/api',
    );
  });

  it('handles trailing slash in URL', () => {
    const comp = makeComponent({
      repository: {
        url: 'https://github.com/org/repo/',
        revision: { branch: 'dev' },
        appPath: 'src',
      },
    });
    expect(getRepositoryUrl(comp)).toBe(
      'https://github.com/org/repo/tree/dev/src',
    );
  });

  it('defaults to main branch when branch is missing', () => {
    const comp = makeComponent({
      repository: {
        url: 'https://github.com/org/repo',
        appPath: 'app',
      },
    });
    expect(getRepositoryUrl(comp)).toBe(
      'https://github.com/org/repo/tree/main/app',
    );
  });

  it('returns just URL when path is missing', () => {
    const comp = makeComponent({
      repository: {
        url: 'https://github.com/org/repo',
        revision: { branch: 'main' },
      },
    });
    expect(getRepositoryUrl(comp)).toBe('https://github.com/org/repo');
  });

  it('returns undefined when no URL', () => {
    expect(getRepositoryUrl(makeComponent())).toBeUndefined();
  });
});

describe('sanitizeLabel', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeLabel('')).toBe('');
  });

  it('converts camelCase to Title Case', () => {
    expect(sanitizeLabel('imagePullPolicy')).toBe('Image Pull Policy');
  });

  it('converts snake_case to Title Case', () => {
    expect(sanitizeLabel('image_pull_policy')).toBe('Image Pull Policy');
  });

  it('preserves all-caps acronyms', () => {
    expect(sanitizeLabel('CPU')).toBe('CPU');
    expect(sanitizeLabel('HTTP')).toBe('HTTP');
  });

  it('converts known lowercase acronyms to uppercase', () => {
    expect(sanitizeLabel('cpu')).toBe('CPU');
    expect(sanitizeLabel('api')).toBe('API');
    expect(sanitizeLabel('url')).toBe('URL');
  });

  it('handles acronyms in camelCase', () => {
    expect(sanitizeLabel('httpPort')).toBe('HTTP Port');
    expect(sanitizeLabel('apiUrl')).toBe('API URL');
  });

  it('inserts space before numbers', () => {
    expect(sanitizeLabel('maxRetries3')).toBe('Max Retries 3');
  });

  it('handles single word', () => {
    expect(sanitizeLabel('name')).toBe('Name');
  });

  it('handles mixed case and underscores', () => {
    expect(sanitizeLabel('max_cpu_limit')).toBe('Max CPU Limit');
  });
});

describe('parseWorkflowParametersAnnotation', () => {
  it('parses key-value pairs separated by newlines', () => {
    const annotation =
      'repoUrl: parameters.repository.url\nbranch: parameters.repository.revision.branch';
    expect(parseWorkflowParametersAnnotation(annotation)).toEqual({
      repoUrl: 'parameters.repository.url',
      branch: 'parameters.repository.revision.branch',
    });
  });

  it('handles empty string', () => {
    expect(parseWorkflowParametersAnnotation('')).toEqual({});
  });

  it('skips blank lines', () => {
    const annotation = 'key1: val1\n\n\nkey2: val2';
    const result = parseWorkflowParametersAnnotation(annotation);
    expect(result).toEqual({ key1: 'val1', key2: 'val2' });
  });

  it('trims whitespace around keys and values', () => {
    expect(parseWorkflowParametersAnnotation('  key  :  value  ')).toEqual({
      key: 'value',
    });
  });

  it('handles values containing colons', () => {
    expect(
      parseWorkflowParametersAnnotation('url: http://example.com'),
    ).toEqual({ url: 'http://example.com' });
  });
});

describe('filterEmptyObjectProperties', () => {
  it('removes empty object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        emptyObj: { type: 'object' },
      },
      required: ['name', 'emptyObj'],
    };
    const result = filterEmptyObjectProperties(schema);

    expect(result.properties.name).toBeDefined();
    expect(result.properties.emptyObj).toBeUndefined();
    expect(result.required).toEqual(['name']);
  });

  it('keeps objects with properties defined', () => {
    const schema = {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          properties: { enabled: { type: 'boolean' } },
        },
      },
    };
    const result = filterEmptyObjectProperties(schema);
    expect(result.properties.settings).toBeDefined();
  });

  it('keeps objects with additionalProperties', () => {
    const schema = {
      type: 'object',
      properties: {
        labels: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
    };
    const result = filterEmptyObjectProperties(schema);
    expect(result.properties.labels).toBeDefined();
  });

  it('keeps objects with enum or const', () => {
    const schema = {
      type: 'object',
      properties: {
        withEnum: { type: 'object', enum: ['a', 'b'] },
        withConst: { type: 'object', const: 'fixed' },
      },
    };
    const result = filterEmptyObjectProperties(schema);
    expect(result.properties.withEnum).toBeDefined();
    expect(result.properties.withConst).toBeDefined();
  });

  it('keeps non-object types', () => {
    const schema = {
      type: 'object',
      properties: {
        str: { type: 'string' },
        num: { type: 'number' },
        arr: { type: 'array', items: { type: 'string' } },
      },
    };
    const result = filterEmptyObjectProperties(schema);
    expect(Object.keys(result.properties)).toHaveLength(3);
  });

  it('returns schema as-is when no properties', () => {
    expect(filterEmptyObjectProperties({ type: 'string' })).toEqual({
      type: 'string',
    });
    expect(filterEmptyObjectProperties(null)).toBeNull();
  });
});
