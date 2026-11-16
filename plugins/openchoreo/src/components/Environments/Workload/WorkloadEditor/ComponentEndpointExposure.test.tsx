import { render, screen } from '@testing-library/react';
import type { ComponentEndpointSummary } from '@openchoreo/backstage-plugin-common';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import { ComponentEndpointExposure } from './ComponentEndpointExposure';

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
      schemas={{ [HTTP_ROUTE]: { type: 'object' } }}
      disabled={false}
      editing={options.editing ?? true}
    />,
  );
}

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

  it("shows a new Endpoint's type without labelling it", () => {
    renderCard(state({ choices: { api: { type: HTTP_ROUTE } } }), {
      visibility: ['external'],
    });

    expect(screen.queryByText(/New Endpoint|created on save/)).toBeNull();
    expect(
      screen.getByRole('button', { name: /http-route/ }),
    ).toBeInTheDocument();
  });

  it('names an existing Endpoint with its Ready state', () => {
    renderCard(
      state({ originals: [original], choices: { api: { type: HTTP_ROUTE } } }),
      { visibility: ['external'] },
    );

    expect(screen.getByText('Endpoint orders-api · Ready')).toBeInTheDocument();
  });

  it('says an existing Endpoint is deleted once its card is project-only', () => {
    renderCard(
      state({ originals: [original], choices: { api: { type: HTTP_ROUTE } } }),
    );

    expect(
      screen.getByText('Endpoint orders-api is deleted on save.'),
    ).toBeInTheDocument();
  });
});
