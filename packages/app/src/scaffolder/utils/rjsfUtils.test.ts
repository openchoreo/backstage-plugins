import { generateUiSchemaWithTitles } from './rjsfUtils';

describe('generateUiSchemaWithTitles', () => {
  it('returns empty object for null/undefined schema', () => {
    expect(generateUiSchemaWithTitles(null)).toEqual({});
    expect(generateUiSchemaWithTitles(undefined)).toEqual({});
  });

  it('returns empty object for non-object schema', () => {
    expect(generateUiSchemaWithTitles('string')).toEqual({});
    expect(generateUiSchemaWithTitles(42)).toEqual({});
  });

  it('returns empty object for schema with no properties', () => {
    expect(generateUiSchemaWithTitles({ type: 'object' })).toEqual({});
  });

  it('adds ui:title for properties without a title', () => {
    const schema = {
      type: 'object',
      properties: {
        port_number: { type: 'integer' },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.port_number).toBeDefined();
    expect(result.port_number['ui:title']).toBe('Port Number');
  });

  it('does not add ui:title for properties that already have a title', () => {
    const schema = {
      type: 'object',
      properties: {
        port: { type: 'integer', title: 'Port' },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.port).toBeUndefined();
  });

  it('handles camelCase keys', () => {
    const schema = {
      type: 'object',
      properties: {
        containerPort: { type: 'integer' },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.containerPort['ui:title']).toBe('Container Port');
  });

  it('handles snake_case keys', () => {
    const schema = {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.file_path['ui:title']).toBe('File Path');
  });

  it('recurses into nested object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        docker: {
          type: 'object',
          properties: {
            build_context: { type: 'string' },
            filePath: { type: 'string', title: 'Dockerfile Path' },
          },
        },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    // Nested property without title gets ui:title
    expect(result.docker.build_context['ui:title']).toBe('Build Context');
    // Nested property with title is not overridden
    expect(result.docker.filePath).toBeUndefined();
  });

  it('handles array items with nested properties', () => {
    const schema = {
      type: 'object',
      properties: {
        envVars: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              var_name: { type: 'string' },
              var_value: { type: 'string', title: 'Value' },
            },
          },
        },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.envVars.items.var_name['ui:title']).toBe('Var Name');
    expect(result.envVars.items.var_value).toBeUndefined();
  });

  it('skips non-object property schemas', () => {
    const schema = {
      type: 'object',
      properties: {
        valid: { type: 'string' },
        invalid: null,
        alsoInvalid: 'not-an-object',
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.valid).toBeDefined();
    expect(result.invalid).toBeUndefined();
    expect(result.alsoInvalid).toBeUndefined();
  });

  it('handles mixed titled and untitled properties', () => {
    const schema = {
      type: 'object',
      properties: {
        port: { type: 'integer', title: 'Port Number' },
        replicas: { type: 'integer' },
        service_name: { type: 'string' },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    expect(result.port).toBeUndefined();
    expect(result.replicas['ui:title']).toBe('Replicas');
    expect(result.service_name['ui:title']).toBe('Service Name');
  });

  it('does not add items key for arrays without nested object items', () => {
    const schema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    };
    const result = generateUiSchemaWithTitles(schema);

    // String array items have no properties, so no items key added
    expect(result.tags?.items).toBeUndefined();
  });
});
