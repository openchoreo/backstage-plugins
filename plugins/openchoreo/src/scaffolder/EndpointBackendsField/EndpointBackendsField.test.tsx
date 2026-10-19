import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  EndpointBackendsField,
  deriveBackendName,
  endpointBackendsFieldValidation,
} from './EndpointBackendsField';
import { EndpointSchemaField } from '../EndpointSchemaField/EndpointSchemaField';
import {
  isRoutable,
  readProjectNamespace,
  toWorkloadEndpointOption,
} from './useProjectWorkloadEndpoints';

function apiEntity(
  component: string,
  endpoint: string,
  visibility: string,
  definition = 'No schema available',
  type = 'openapi',
) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: `store-${component}-${endpoint}`,
      namespace: 'acme',
      annotations: {
        'openchoreo.io/project': 'store',
        'openchoreo.io/component': component,
        'openchoreo.io/endpoint-name': endpoint,
        'openchoreo.io/endpoint-visibility': visibility,
      },
    },
    spec: { type, definition },
  };
}

const APIS = [
  apiEntity('orders', 'http', 'external', 'openapi: 3.0.0'),
  apiEntity('orders', 'admin', 'project'),
  apiEntity('billing', 'grpc', 'internal'),
];

const formContext = {
  formData: {
    project_namespace: {
      project_name: 'store',
      namespace_name: 'domain:default/acme',
    },
  },
};

function makeCatalog(items = APIS) {
  return { getEntities: jest.fn().mockResolvedValue({ items }) };
}

function validate(value: any) {
  const errors: string[] = [];
  endpointBackendsFieldValidation(value, {
    addError: (e: string) => errors.push(e),
  } as any);
  return errors;
}

describe('workload endpoint options', () => {
  it('reads component, endpoint, visibility and schema from an API entity', () => {
    expect(toWorkloadEndpointOption(APIS[0] as any)).toEqual({
      component: 'orders',
      endpoint: 'http',
      visibility: ['external'],
      schemaType: 'openapi',
      schemaContent: 'openapi: 3.0.0',
    });
    expect(
      toWorkloadEndpointOption(APIS[1] as any)?.schemaContent,
    ).toBeUndefined();
  });

  it('routes only to internal or external endpoints', () => {
    expect(isRoutable(toWorkloadEndpointOption(APIS[0] as any)!)).toBe(true);
    expect(isRoutable(toWorkloadEndpointOption(APIS[1] as any)!)).toBe(false);
  });

  it('strips entity-ref prefixes from the project form value', () => {
    expect(
      readProjectNamespace(formContext.formData, 'project_namespace'),
    ).toEqual({
      project: 'store',
      namespace: 'acme',
    });
  });
});

describe('deriveBackendName', () => {
  it('names a backend after its component and endpoint, uniquely', () => {
    expect(deriveBackendName('orders', 'http', [])).toBe('orders-http');
    expect(deriveBackendName('orders', 'http', ['orders-http'])).toBe(
      'orders-http-2',
    );
    expect(deriveBackendName('Orders', 'HTTP_v2', [])).toBe('orders-http-v2');
  });
});

describe('endpointBackendsFieldValidation', () => {
  const row = { name: 'orders-http', component: 'orders', endpoint: 'http' };

  it('requires at least one complete backend', () => {
    expect(validate([])).toEqual(['Add at least one backend.']);
    expect(validate([{ ...row, endpoint: '' }])[0]).toMatch(/pick a component/);
  });

  it('rejects duplicate names and bad weights', () => {
    expect(validate([row, row])).toContain(
      'Backend 2: name "orders-http" is already used.',
    );
    expect(validate([{ ...row, weight: 1.5 }])[0]).toMatch(/whole number/);
  });

  it('requires some backend to take traffic', () => {
    expect(validate([{ ...row, weight: 0 }])).toEqual([
      'At least one backend needs a weight above 0.',
    ]);
    expect(validate([row])).toEqual([]);
  });
});

describe('EndpointBackendsField', () => {
  it('asks for a project before offering backends', () => {
    render(
      <TestApiProvider apis={[[catalogApiRef, makeCatalog()]]}>
        <EndpointBackendsField
          {...({
            formData: [],
            onChange: jest.fn(),
            formContext: { formData: {} },
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );
    expect(screen.getByText('Select a project first.')).toBeInTheDocument();
  });

  it('queries the project API entities and adds a first backend at full weight', async () => {
    const catalog = makeCatalog();
    const onChange = jest.fn();
    render(
      <TestApiProvider apis={[[catalogApiRef, catalog]]}>
        <EndpointBackendsField
          {...({ formData: [], onChange, formContext, uiSchema: {} } as any)}
        />
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /add backend/i }),
      ).toBeEnabled(),
    );
    expect(catalog.getEntities).toHaveBeenCalledWith({
      filter: {
        kind: 'API',
        'metadata.namespace': 'acme',
        'metadata.annotations.openchoreo.io/project': 'store',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /add backend/i }));
    expect(onChange).toHaveBeenCalledWith([
      { name: '', component: '', endpoint: '', weight: 100 },
    ]);
  });

  it('offers only routable workload endpoints of the chosen component', async () => {
    render(
      <TestApiProvider apis={[[catalogApiRef, makeCatalog()]]}>
        <EndpointBackendsField
          {...({
            formData: [
              { name: '', component: 'orders', endpoint: '', weight: 100 },
            ],
            onChange: jest.fn(),
            formContext,
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /add backend/i }),
      ).toBeEnabled(),
    );
    fireEvent.mouseDown(
      screen.getByRole('button', { name: 'Workload endpoint for backend 1' }),
    );
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('http (external)')).toBeInTheDocument();
    expect(within(listbox).queryByText(/admin/)).toBeNull();
  });
});

describe('EndpointSchemaField', () => {
  it("copies the first backend's workload endpoint schema", async () => {
    const onChange = jest.fn();
    render(
      <TestApiProvider apis={[[catalogApiRef, makeCatalog()]]}>
        <EndpointSchemaField
          {...({
            formData: undefined,
            onChange,
            formContext: {
              formData: {
                ...formContext.formData,
                backends: [
                  {
                    name: 'orders-http',
                    component: 'orders',
                    endpoint: 'http',
                  },
                ],
              },
            },
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        type: 'openapi',
        content: 'openapi: 3.0.0',
        copiedFrom: 'orders/http',
      }),
    );
  });

  it('keeps an edited schema instead of re-copying it', async () => {
    const onChange = jest.fn();
    render(
      <TestApiProvider apis={[[catalogApiRef, makeCatalog()]]}>
        <EndpointSchemaField
          {...({
            formData: { type: 'openapi', content: 'my own schema' },
            onChange,
            formContext: {
              formData: {
                ...formContext.formData,
                backends: [
                  {
                    name: 'orders-http',
                    component: 'orders',
                    endpoint: 'http',
                  },
                ],
              },
            },
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );

    expect(
      await screen.findByDisplayValue('my own schema'),
    ).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 0));
    expect(onChange).not.toHaveBeenCalled();
  });
});
