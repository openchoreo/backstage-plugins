import { render, screen } from '@testing-library/react';
import type { ComponentEndpointSummary } from '@openchoreo/backstage-plugin-common';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import {
  ComponentEndpointExposure,
  ComponentEndpointTypeHeader,
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

function renderHeader(
  componentEndpoints: ComponentEndpointsState,
  details: Record<string, { title?: string; description?: string }> = {},
) {
  render(
    <ComponentEndpointTypeHeader
      workloadEndpoint="api"
      endpoint={{ protocol: 'HTTP', visibility: ['project', 'external'] }}
      state={componentEndpoints}
      details={details}
    />,
  );
}

describe('ComponentEndpointTypeHeader', () => {
  it("names the card's Endpoint type with its catalog title and description", () => {
    renderHeader(state({ choices: { api: { type: HTTP_ROUTE } } }), {
      [HTTP_ROUTE]: {
        title: 'HTTP route',
        description: 'Routes HTTP traffic through the gateway.',
      },
    });

    expect(screen.getByText('Endpoint type')).toBeInTheDocument();
    expect(screen.getByText('HTTP route')).toBeInTheDocument();
    expect(
      screen.getByText('Routes HTTP traffic through the gateway.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Exposed as/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("falls back to the type's name without catalog details", () => {
    renderHeader(state({ choices: { api: { type: HTTP_ROUTE } } }));

    expect(screen.getByText('http-route')).toBeInTheDocument();
    expect(
      screen.getByText('Exposes the endpoint through http-route.'),
    ).toBeInTheDocument();
  });

  it('shows no heading for a card without an Endpoint type', () => {
    renderHeader(state());

    expect(screen.queryByText('Endpoint type')).toBeNull();
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
            'http-route · Endpoint orders-api · Ready · pathPrefix: /orders',
      ),
    ).toBeInTheDocument();
  });

  it('says an existing Endpoint is deleted once its card has no visibility', () => {
    renderCard(
      state({ originals: [original], choices: { api: { type: HTTP_ROUTE } } }),
      { editing: false, visibility: [] },
    );

    expect(
      screen.getByText('Endpoint orders-api is deleted on save.'),
    ).toBeInTheDocument();
  });
});
