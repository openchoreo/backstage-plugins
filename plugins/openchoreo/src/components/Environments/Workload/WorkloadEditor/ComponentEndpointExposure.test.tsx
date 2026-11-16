import { fireEvent, render, screen } from '@testing-library/react';
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

function renderRow(
  componentEndpoints: ComponentEndpointsState,
  options: { visibility?: string[]; editing?: boolean } = {},
) {
  render(
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
  it('offers to add an Endpoint to a row without one, preselecting the default type', () => {
    const componentEndpoints = state();
    renderRow(componentEndpoints);

    expect(
      screen.getByText('No Endpoint: reachable within the project only.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/New Endpoint/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Endpoint' }));
    expect(componentEndpoints.setChoice).toHaveBeenCalledWith('api', {
      type: HTTP_ROUTE,
    });
  });

  it('shows visibility the workload still carries as deprecated, without an Endpoint', () => {
    renderRow(state(), { visibility: ['external'] });

    expect(
      screen.getByText(/external visibility is on the workload \(deprecated\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add Endpoint' }),
    ).toBeInTheDocument();
  });

  it('only offers to add an Endpoint while the row is edited', () => {
    renderRow(state(), { editing: false });

    expect(screen.queryByRole('button', { name: 'Add Endpoint' })).toBeNull();
  });

  it('shows an added Endpoint as created on save, with a way to remove it', () => {
    const componentEndpoints = state({
      choices: { api: { type: HTTP_ROUTE } },
    });
    renderRow(componentEndpoints, { visibility: ['external'] });

    expect(
      screen.getByText('New Endpoint · created on save'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(componentEndpoints.restoreChoice).toHaveBeenCalledWith(
      'api',
      undefined,
    );
  });

  it('asks for a visibility for an added Endpoint that has none', () => {
    renderRow(state({ choices: { api: { type: HTTP_ROUTE } } }));

    expect(
      screen.getByText(/Select a visibility beyond project for it/),
    ).toBeInTheDocument();
  });

  it('names an existing Endpoint with its Ready state', () => {
    renderRow(
      state({
        originals: [original],
        choices: { api: { type: HTTP_ROUTE } },
      }),
      { visibility: ['external'] },
    );

    expect(screen.getByText('Endpoint orders-api · Ready')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});
