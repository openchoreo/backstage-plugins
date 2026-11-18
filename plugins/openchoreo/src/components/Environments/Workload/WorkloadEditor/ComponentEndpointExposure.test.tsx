import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ComponentEndpointSummary,
  WorkloadEndpoint,
} from '@openchoreo/backstage-plugin-common';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import {
  ComponentEndpointExposure,
  ComponentEndpointTypeField,
} from './ComponentEndpointExposure';

const HTTP_ROUTE = 'ClusterEndpointType/http-route';

function state(
  overrides: Partial<ComponentEndpointsState> = {},
): ComponentEndpointsState {
  return {
    loading: false,
    loadError: null,
    allowedEndpoints: [
      {
        protocols: ['HTTP'],
        ref: { kind: 'ClusterEndpointType', name: 'http-route' },
        default: true,
      },
    ],
    originals: [],
    draftedFromMain: 0,
    choices: {},
    renames: {},
    mode: 'endpoints',
    deprecatedRows: {},
    canUseEndpoints: true,
    setChoice: jest.fn(),
    restoreChoice: jest.fn(),
    renameWorkloadEndpoint: jest.fn(),
    prepare: endpoints => endpoints,
    apply: jest.fn(),
    ...overrides,
  };
}

const original: ComponentEndpointSummary = {
  name: 'orders-api',
  releaseLine: '',
  workloadEndpoint: 'api',
  typeKind: 'ClusterEndpointType',
  typeName: 'http-route',
  visibility: ['external'],
  parameters: {},
  autoDeploy: true,
  ready: { status: 'True', reason: 'Ready' },
};

const grpcRoute = {
  protocols: ['gRPC'],
  ref: { kind: 'ClusterEndpointType', name: 'grpc-route' },
};

function renderCard(
  componentEndpoints: ComponentEndpointsState,
  options: { visibility?: string[]; editing?: boolean } = {},
) {
  return render(
    <ComponentEndpointExposure
      workloadEndpoint="api"
      endpoint={{
        protocol: 'HTTP',
        visibility: options.visibility ?? ['project'],
      }}
      state={componentEndpoints}
      schemas={{
        [HTTP_ROUTE]: {
          type: 'object',
          properties: { pathPrefix: { type: 'string', title: 'Path prefix' } },
        },
      }}
      disabled={false}
      editing={options.editing ?? true}
    />,
  );
}

function renderTypeField(
  componentEndpoints: ComponentEndpointsState,
  visibility: WorkloadEndpoint['visibility'] = ['project'],
) {
  const onEndpointChange = jest.fn();
  render(
    <ComponentEndpointTypeField
      workloadEndpoint="api"
      endpoint={{ type: 'HTTP', protocol: 'HTTP', port: 8080, visibility }}
      state={componentEndpoints}
      onEndpointChange={onEndpointChange}
      disabled={false}
    />,
  );
  return onEndpointChange;
}

async function pick(option: RegExp) {
  fireEvent.mouseDown(screen.getByRole('button', { name: /Exposed as/ }));
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('ComponentEndpointTypeField', () => {
  it('shows a card without a type as project only', () => {
    renderTypeField(state());

    expect(
      screen.getByRole('button', { name: /Project only/ }),
    ).toBeInTheDocument();
  });

  it("limits the card to the picked type's protocols", async () => {
    const componentEndpoints = state({
      allowedEndpoints: [...state().allowedEndpoints, grpcRoute],
    });
    const onEndpointChange = renderTypeField(componentEndpoints);

    await pick(/grpc-route/);

    expect(componentEndpoints.setChoice).toHaveBeenCalledWith('api', {
      type: 'ClusterEndpointType/grpc-route',
      parameters: {},
    });
    expect(onEndpointChange).toHaveBeenCalledWith('protocol', 'gRPC');
    expect(onEndpointChange).toHaveBeenCalledWith('type', 'gRPC');
  });

  it('keeps a protocol the picked type serves', async () => {
    const onEndpointChange = renderTypeField(state());

    await pick(/http-route/);

    expect(onEndpointChange).not.toHaveBeenCalledWith(
      'protocol',
      expect.anything(),
    );
  });

  it('drops the type and visibility beyond project for project only', async () => {
    const componentEndpoints = state({
      choices: { api: { type: HTTP_ROUTE } },
    });
    const onEndpointChange = renderTypeField(componentEndpoints, [
      'project',
      'external',
    ]);

    await pick(/Project only/);

    expect(componentEndpoints.restoreChoice).toHaveBeenCalledWith(
      'api',
      undefined,
    );
    expect(onEndpointChange).toHaveBeenCalledWith('visibility', ['project']);
  });

  it("fixes an existing Endpoint's type, and names it with its Ready state", async () => {
    renderTypeField(
      state({
        allowedEndpoints: [...state().allowedEndpoints, grpcRoute],
        originals: [original],
        choices: { api: { type: HTTP_ROUTE } },
      }),
      ['project', 'external'],
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Endpoint orders-api')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/An Endpoint's type is fixed once created/),
    ).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: /Exposed as/ }));
    expect(
      await screen.findByRole('option', { name: /grpc-route/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('option', { name: /Project only/ }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('says an existing Endpoint is deleted once the card is project only', () => {
    renderTypeField(state({ originals: [original] }));

    expect(
      screen.getByText('Endpoint orders-api is deleted on save.'),
    ).toBeInTheDocument();
  });

  it("puts back an existing Endpoint's visibility and parameters", async () => {
    const componentEndpoints = state({
      originals: [{ ...original, parameters: { pathPrefix: '/orders' } }],
    });
    const onEndpointChange = renderTypeField(componentEndpoints);

    await pick(/http-route/);

    expect(componentEndpoints.setChoice).toHaveBeenCalledWith('api', {
      type: HTTP_ROUTE,
      parameters: { pathPrefix: '/orders' },
    });
    expect(onEndpointChange).toHaveBeenCalledWith('visibility', [
      'project',
      'external',
    ]);
  });
});

describe('ComponentEndpointExposure', () => {
  it('shows nothing for a project-only card', () => {
    const componentEndpoints = state();
    const { container } = renderCard(componentEndpoints);

    expect(container).toBeEmptyDOMElement();
    expect(componentEndpoints.setChoice).not.toHaveBeenCalled();
  });

  it('gives a card the default Endpoint type once its editor takes visibility beyond project', () => {
    const componentEndpoints = state();
    renderCard(componentEndpoints, { visibility: ['external'] });

    expect(componentEndpoints.setChoice).toHaveBeenCalledWith('api', {
      type: HTTP_ROUTE,
    });
  });

  it('chooses nothing for a card that is not being edited', () => {
    const componentEndpoints = state();
    renderCard(componentEndpoints, {
      visibility: ['external'],
      editing: false,
    });

    expect(componentEndpoints.setChoice).not.toHaveBeenCalled();
  });

  it("shows the type's parameters while editing", () => {
    renderCard(state({ choices: { api: { type: HTTP_ROUTE } } }));

    expect(screen.getByLabelText(/Path prefix/)).toBeInTheDocument();
  });

  it('sums up how a card is exposed when not editing', () => {
    renderCard(
      state({
        originals: [original],
        choices: {
          api: { type: HTTP_ROUTE, parameters: { pathPrefix: '/orders' } },
        },
      }),
      { visibility: ['external'], editing: false },
    );

    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === 'P' &&
          el.textContent ===
            'Exposed as http-route · Endpoint orders-api · Ready · pathPrefix: /orders',
      ),
    ).toBeInTheDocument();
  });

  it('says an existing Endpoint is deleted once its card is project-only', () => {
    renderCard(
      state({ originals: [original], choices: { api: { type: HTTP_ROUTE } } }),
      { editing: false },
    );

    expect(
      screen.getByText('Endpoint orders-api is deleted on save.'),
    ).toBeInTheDocument();
  });
});
