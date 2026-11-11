import { useState } from 'react';
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
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import {
  readProjectNamespace,
  workloadEndpointOptions,
} from './useProjectWorkloadEndpoints';

function component(name: string) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: 'acme',
      annotations: {
        'openchoreo.io/project': 'store',
        'openchoreo.io/component': name,
        'openchoreo.io/namespace': 'acme',
      },
    },
    spec: {},
  };
}

const COMPONENTS = [
  component('orders'),
  component('billing'),
  component('batch'),
];

// orders/http has a schema; billing/grpc has none, which the catalog's API
// entities would miss.
const WORKLOADS: Record<string, any> = {
  orders: {
    spec: {
      endpoints: {
        http: {
          port: 8080,
          type: 'HTTP',
          visibility: ['external'],
          schema: { type: 'openapi', content: 'openapi: 3.0.0' },
        },
        admin: { port: 9090, type: 'HTTP' },
      },
    },
  },
  billing: {
    spec: {
      endpoints: {
        grpc: { port: 5000, type: 'gRPC', visibility: ['internal'] },
      },
    },
  },
};

function makeApis(): [any, any][] {
  const catalog = {
    getEntities: jest.fn().mockResolvedValue({ items: COMPONENTS }),
  };
  const client = {
    fetchWorkloadInfo: jest.fn((entity: any) => {
      const workload = WORKLOADS[entity.metadata.name];
      return workload
        ? Promise.resolve(workload)
        : Promise.reject(new Error('No workload found for this component'));
    }),
  };
  return [
    [catalogApiRef, catalog],
    [openChoreoClientApiRef, client],
  ];
}

const formContext = {
  formData: {
    project_namespace: {
      project_name: 'store',
      namespace_name: 'domain:default/acme',
    },
  },
};

function validate(value: any) {
  const errors: string[] = [];
  endpointBackendsFieldValidation(value, {
    addError: (e: string) => errors.push(e),
  } as any);
  return errors;
}

describe('workload endpoint options', () => {
  it("reads endpoints and schema from a Workload's spec", () => {
    expect(
      workloadEndpointOptions('orders', WORKLOADS.orders.spec.endpoints),
    ).toEqual([
      {
        component: 'orders',
        endpoint: 'http',
        schemaType: 'openapi',
        schemaContent: 'openapi: 3.0.0',
      },
      { component: 'orders', endpoint: 'admin' },
    ]);
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

  it('never ends a long name with a hyphen', () => {
    // The 60-character cut falls just after the hyphen.
    const name = deriveBackendName('a'.repeat(59), 'b', []);
    expect(name).toBe('a'.repeat(59));
    expect(name).toMatch(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
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

  it('enforces the Endpoint limits on backends and weights', () => {
    const many = Array.from({ length: 17 }, (_, i) => ({
      ...row,
      name: `orders-http-${i}`,
    }));
    expect(validate(many)).toContain('An Endpoint takes at most 16 backends.');
    expect(validate(many.slice(0, 16))).toEqual([]);
    expect(validate([{ ...row, weight: 1_000_001 }])[0]).toMatch(
      /from 0 to 1,000,000/,
    );
    expect(validate([{ ...row, weight: 1_000_000 }])).toEqual([]);
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
      <TestApiProvider apis={makeApis()}>
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

  it("reads the project's components and their Workloads, then adds a first backend at full weight", async () => {
    const apis = makeApis();
    const [[, catalog], [, client]] = apis;
    const onChange = jest.fn();
    render(
      <TestApiProvider apis={apis}>
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
        kind: 'Component',
        'metadata.namespace': 'acme',
        'metadata.annotations.openchoreo.io/project': 'store',
      },
    });
    expect(client.fetchWorkloadInfo).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: /add backend/i }));
    expect(onChange).toHaveBeenCalledWith([
      { name: '', component: '', endpoint: '', weight: 100 },
    ]);
  });

  it('offers every workload endpoint of the chosen component, whatever its visibility', async () => {
    render(
      <TestApiProvider apis={makeApis()}>
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
    // `admin` sets no (deprecated) workload visibility; it is still a backend.
    expect(within(listbox).getByText('http')).toBeInTheDocument();
    expect(within(listbox).getByText('admin')).toBeInTheDocument();
  });

  it('offers a workload endpoint that has no schema', async () => {
    render(
      <TestApiProvider apis={makeApis()}>
        <EndpointBackendsField
          {...({
            formData: [
              { name: '', component: 'billing', endpoint: '', weight: 100 },
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
    expect(within(listbox).getByText('grpc')).toBeInTheDocument();
  });

  it("drops rows whose component isn't in the selected project", async () => {
    // `payments` was picked under another project before going back.
    const onChange = jest.fn();
    const kept = { name: 'orders-http', component: 'orders', endpoint: 'http' };
    render(
      <TestApiProvider apis={makeApis()}>
        <EndpointBackendsField
          {...({
            formData: [
              {
                name: 'payments-http',
                component: 'payments',
                endpoint: 'http',
              },
              kept,
            ],
            onChange,
            formContext,
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([kept]));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("keeps a component's rows when its Workload can't be read", async () => {
    // `batch` is in the project, but its Workload lookup fails.
    const onChange = jest.fn();
    const batch = { name: 'batch-http', component: 'batch', endpoint: 'http' };
    render(
      <TestApiProvider apis={makeApis()}>
        <EndpointBackendsField
          {...({
            formData: [
              {
                name: 'payments-http',
                component: 'payments',
                endpoint: 'http',
              },
              batch,
            ],
            onChange,
            formContext,
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([batch]));
  });

  it('stops adding backends at the limit', async () => {
    const full = Array.from({ length: 16 }, (_, i) => ({
      name: `orders-http-${i}`,
      component: 'orders',
      endpoint: 'http',
    }));
    render(
      <TestApiProvider apis={makeApis()}>
        <EndpointBackendsField
          {...({
            formData: full,
            onChange: jest.fn(),
            formContext,
            uiSchema: {},
          } as any)}
        />
      </TestApiProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /^Remove backend/ }),
      ).toHaveLength(16),
    );
    expect(screen.getByRole('button', { name: /add backend/i })).toBeDisabled();
  });
});

function schemaField(
  formData: any,
  onChange: jest.Mock,
  firstBackend = 'orders',
) {
  const endpoint = firstBackend === 'billing' ? 'grpc' : 'http';
  return (
    <TestApiProvider apis={makeApis()}>
      <EndpointSchemaField
        {...({
          formData,
          onChange,
          formContext: {
            formData: {
              ...formContext.formData,
              backends: [
                {
                  name: `${firstBackend}-${endpoint}`,
                  component: firstBackend,
                  endpoint,
                },
              ],
            },
          },
          uiSchema: {},
        } as any)}
      />
    </TestApiProvider>
  );
}

/** Holds the field's value in state, as the scaffolder form does. */
function ControlledSchemaField({
  initial,
  onChange,
}: {
  initial: any;
  onChange: jest.Mock;
}) {
  const [value, setValue] = useState(initial);
  return schemaField(value, ((next: any) => {
    setValue(next);
    onChange(next);
  }) as jest.Mock);
}

describe('EndpointSchemaField', () => {
  it('is off by default and sets no schema', async () => {
    const onChange = jest.fn();
    render(schemaField(undefined, onChange));

    expect(
      await screen.findByRole('checkbox', { name: /add an api schema/i }),
    ).not.toBeChecked();
    expect(
      screen.getByText(/^Optional\. Add the API definition/),
    ).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("copies the first backend's schema when turned on", async () => {
    const onChange = jest.fn();
    render(<ControlledSchemaField initial={undefined} onChange={onChange} />);

    const checkbox = await screen.findByRole('checkbox', {
      name: /add an api schema/i,
    });
    // Copies once the first backend's schema has loaded, even if turned on
    // before that.
    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        type: 'openapi',
        content: 'openapi: 3.0.0',
        copiedFrom: 'orders/http',
      }),
    );
  });

  it('keeps an edited schema instead of re-copying it', async () => {
    const onChange = jest.fn();
    render(
      schemaField(
        { type: 'openapi', content: 'my own schema', edited: true },
        onChange,
      ),
    );

    expect(
      await screen.findByDisplayValue('my own schema'),
    ).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 0));
    expect(onChange).not.toHaveBeenCalled();
    // The hint says it was edited, not that there was nothing to copy.
    expect(screen.getByText(/^Edited\./)).toBeInTheDocument();
    expect(screen.queryByText(/none to start from/)).not.toBeInTheDocument();
  });

  it('stays on when revisited with nothing to copy', async () => {
    // On, but the first backend has no schema: content is empty, not unset.
    const onChange = jest.fn();
    render(schemaField({ type: 'openapi', content: '' }, onChange, 'billing'));

    expect(
      await screen.findByRole('checkbox', { name: /add an api schema/i }),
    ).toBeChecked();
    expect(await screen.findByText(/none to start from/)).toBeInTheDocument();
  });

  it('sends a provided schema with its type', async () => {
    const onChange = jest.fn();
    render(schemaField({ type: 'openapi', content: '' }, onChange, 'billing'));

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'openapi: 3.1.0' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'openapi',
      content: 'openapi: 3.1.0',
      edited: true,
    });
  });

  it('keeps a cleared schema cleared when the step is revisited', async () => {
    // The user cleared the copied schema; the first backend still has one.
    const onChange = jest.fn();
    render(
      <ControlledSchemaField
        initial={{ type: 'openapi', content: '', edited: true }}
        onChange={onChange}
      />,
    );

    expect(
      await screen.findByRole('checkbox', { name: /add an api schema/i }),
    ).toBeChecked();
    // Give the first backend's schema time to load.
    await waitFor(() =>
      expect(
        screen.getByText(/^Provide the API definition/),
      ).toBeInTheDocument(),
    );
    await new Promise(r => setTimeout(r, 50));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});
