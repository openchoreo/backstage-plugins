import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';
import { generateUiSchemaWithTitles } from './uiSchema';

describe('generateUiSchemaWithTitles', () => {
  it('returns an empty object for non-object schemas', () => {
    expect(generateUiSchemaWithTitles(null)).toEqual({});
    expect(generateUiSchemaWithTitles(undefined)).toEqual({});
    expect(generateUiSchemaWithTitles('nope' as any)).toEqual({});
  });

  it('adds a sanitized ui:title only for properties without their own title', () => {
    const schema = {
      type: 'object',
      properties: {
        minReplicas: { type: 'integer' },
        maxReplicas: { type: 'integer', title: 'Max Replicas' },
      },
    };

    const ui = generateUiSchemaWithTitles(schema);

    expect(ui.minReplicas['ui:title']).toBe(sanitizeLabel('minReplicas'));
    expect(ui.maxReplicas['ui:title']).toBeUndefined();
  });

  it('folds a root-level portal fragment into the root uiSchema', () => {
    const schema = {
      type: 'object',
      'x-openchoreo-backstage-portal': {
        'ui:order': ['maxReplicas', 'minReplicas'],
      },
      properties: {
        minReplicas: { type: 'integer' },
        maxReplicas: { type: 'integer' },
      },
    };

    const ui = generateUiSchemaWithTitles(schema);

    expect(ui['ui:order']).toEqual(['maxReplicas', 'minReplicas']);
    expect(ui.minReplicas['ui:title']).toBe(sanitizeLabel('minReplicas'));
  });

  it('folds a leaf property portal fragment into that field', () => {
    const schema = {
      type: 'object',
      properties: {
        targetCPUUtilizationPercentage: {
          type: 'integer',
          'x-openchoreo-backstage-portal': { 'ui:widget': 'range' },
        },
      },
    };

    const ui = generateUiSchemaWithTitles(schema);

    expect(ui.targetCPUUtilizationPercentage['ui:widget']).toBe('range');
    // generated title survives alongside the folded fragment
    expect(ui.targetCPUUtilizationPercentage['ui:title']).toBe(
      sanitizeLabel('targetCPUUtilizationPercentage'),
    );
  });

  it('lets a portal ui:title override the generated title', () => {
    const schema = {
      type: 'object',
      properties: {
        minReplicas: {
          type: 'integer',
          'x-openchoreo-backstage-portal': { 'ui:title': 'Minimum Replicas' },
        },
      },
    };

    const ui = generateUiSchemaWithTitles(schema);

    expect(ui.minReplicas['ui:title']).toBe('Minimum Replicas');
  });

  it('merges ui:options so generated options are not dropped', () => {
    const schema = {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          'x-openchoreo-backstage-portal': {
            'ui:options': { widget: 'radio' },
          },
        },
      },
    };

    const ui = generateUiSchemaWithTitles(schema, true);

    expect(ui.enabled['ui:options']).toEqual({
      hideError: true,
      widget: 'radio',
    });
  });

  it('folds a nested object portal fragment into the nested field', () => {
    const schema = {
      type: 'object',
      properties: {
        source: {
          type: 'object',
          'x-openchoreo-backstage-portal': {
            'ui:order': ['type', 'query'],
          },
          properties: {
            type: { type: 'string' },
            query: { type: 'string' },
          },
        },
      },
    };

    const ui = generateUiSchemaWithTitles(schema);

    expect(ui.source['ui:order']).toEqual(['type', 'query']);
    expect(ui.source.type['ui:title']).toBe(sanitizeLabel('type'));
  });

  it('folds an array node portal fragment and keeps item titles under items', () => {
    const schema = {
      type: 'object',
      properties: {
        channels: {
          type: 'array',
          'x-openchoreo-backstage-portal': { 'ui:field': 'ChannelPicker' },
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
    };

    const ui = generateUiSchemaWithTitles(schema);

    expect(ui.channels['ui:field']).toBe('ChannelPicker');
    expect(ui.channels.items.name['ui:title']).toBe(sanitizeLabel('name'));
  });
});
