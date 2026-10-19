import { EtdToTemplateConverter } from './EtdToTemplateConverter';

const httpRoute = {
  metadata: {
    name: 'http-route',
    displayName: 'HTTP Route',
    description: 'Routes HTTP traffic through the gateway',
  },
  spec: {
    parameters: {
      openAPIV3Schema: {
        type: 'object' as const,
        properties: { basePath: { type: 'string' as const } },
      },
    },
  },
};

describe('EtdToTemplateConverter', () => {
  const converter = new EtdToTemplateConverter({
    defaultOwner: 'group:default/devs',
  });

  it('generates a namespaced Endpoint template per EndpointType', () => {
    const template = converter.convertEtdToTemplateEntity(httpRoute, 'acme');

    expect(template.kind).toBe('Template');
    expect(template.metadata.name).toBe('template-endpoint-http-route');
    expect(template.metadata.namespace).toBe('acme');
    expect(template.metadata.title).toBe('HTTP Route');
    expect(template.metadata.annotations).toMatchObject({
      'openchoreo.io/etd-name': 'http-route',
      'openchoreo.io/etd-generated': 'true',
      'openchoreo.io/etd-kind': 'EndpointType',
      'openchoreo.io/etd-display-name': 'HTTP Route',
    });
    expect(template.spec?.type).toBe('Endpoint');
    expect(template.spec?.owner).toBe('group:default/devs');
  });

  it('places cluster templates in openchoreo-cluster without a default namespace', () => {
    const template = converter.convertClusterEtdToTemplateEntity(httpRoute);
    const [metadata] = (template.spec as any).parameters;

    expect(template.metadata.namespace).toBe('openchoreo-cluster');
    expect(template.metadata.annotations?.['openchoreo.io/etd-kind']).toBe(
      'ClusterEndpointType',
    );
    expect(
      metadata.properties.project_namespace['ui:options'].defaultNamespace,
    ).toBe('');
  });

  it('collects routing, schema and the type parameters', () => {
    const template = converter.convertEtdToTemplateEntity(httpRoute, 'acme');
    const [, routing, details] = (template.spec as any).parameters;

    expect(routing.required).toEqual(['visibility', 'backends']);
    expect(routing.properties.visibility.items.enum).toEqual([
      'namespace',
      'internal',
      'external',
    ]);
    expect(routing.properties.backends['ui:field']).toBe(
      'EndpointBackendsField',
    );
    expect(routing.properties.schema['ui:field']).toBe('EndpointSchemaField');
    expect(details.properties.parameters['ui:options'].rtdSchema).toEqual(
      httpRoute.spec.parameters.openAPIV3Schema,
    );
  });

  it('creates the Endpoint through openchoreo:endpoint:create', () => {
    const template = converter.convertEtdToTemplateEntity(httpRoute, 'acme');
    const [step] = (template.spec as any).steps;

    expect(step.action).toBe('openchoreo:endpoint:create');
    expect(step.input).toMatchObject({
      typeKind: 'EndpointType',
      typeName: 'http-route',
      endpointName: '${{ parameters.endpoint_name }}',
      backends: '${{ parameters.backends }}',
      schema: '${{ parameters.schema }}',
    });
  });

  it('derives a title from the name when there is no display name', () => {
    const template = converter.convertEtdToTemplateEntity(
      { metadata: { name: 'grpc-route' }, spec: {} },
      'acme',
    );
    expect(template.metadata.title).toBe('Grpc Route');
    expect(
      template.metadata.annotations?.['openchoreo.io/etd-display-name'],
    ).toBeUndefined();
  });
});
