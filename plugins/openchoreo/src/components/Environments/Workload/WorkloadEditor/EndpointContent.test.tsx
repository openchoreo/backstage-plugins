import { render, screen, fireEvent } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import { EndpointContent } from './EndpointContent';

jest.mock('../WorkloadContext', () => ({
  useWorkloadContext: () => ({ setEditingSection: jest.fn() }),
}));

// The list stub shows which form is rendered: the Endpoints form passes
// row details and a visibility rule, the legacy form neither.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEndpointEditBuffer: () => ({
    isAnyRowEditing: false,
    startEdit: jest.fn(),
    applyEdit: jest.fn(),
    cancelEdit: jest.fn(),
  }),
  EndpointList: (props: any) => (
    <div data-testid="endpoint-list">
      {Object.entries(props.endpoints).map(
        ([name, endpoint]: [string, any]) => (
          <div key={name}>
            {props.renderDetails ? 'endpoints-form' : 'legacy-form'}
            {props.visibilityDisabledReason?.(endpoint)}
            {props.renderDetails?.(name, endpoint, name, false)}
            <button
              type="button"
              onClick={() => props.editBuffer.startEdit(name)}
            >
              edit {name}
            </button>
            <button type="button" onClick={() => props.editBuffer.cancelEdit()}>
              cancel {name}
            </button>
          </div>
        ),
      )}
    </div>
  ),
}));

jest.mock('./EndpointExposure', () => ({
  chosenEndpointTypeKeys: () => [],
  useEndpointTypeSchemas: () => ({}),
}));

jest.mock('./ComponentEndpointExposure', () => ({
  ComponentEndpointExposure: (props: any) => (
    <span>{props.editing ? 'details-editable' : 'details-read-only'}</span>
  ),
  DetachedComponentEndpoints: () => null,
}));

const httpRoute = {
  protocols: ['HTTP'],
  ref: { kind: 'ClusterEndpointType', name: 'http-route' },
  default: true,
};

function state(
  overrides: Partial<ComponentEndpointsState> = {},
): ComponentEndpointsState {
  return {
    loading: false,
    loadError: null,
    allowedEndpoints: [httpRoute],
    originals: [],
    draftedFromMain: 0,
    choices: {},
    renames: {},
    mode: 'endpoints',
    initialMode: 'endpoints',
    setMode: jest.fn(),
    canUseEndpoints: true,
    setChoice: jest.fn(),
    restoreChoice: jest.fn(),
    renameWorkloadEndpoint: jest.fn(),
    prepare: endpoints => endpoints,
    apply: jest.fn(),
    ...overrides,
  };
}

function renderContent(componentEndpoints?: ComponentEndpointsState) {
  render(
    <EntityProvider entity={mockComponentEntity()}>
      <EndpointContent
        endpoints={{
          api: { type: 'HTTP', port: 8080, visibility: ['external'] },
          raw: { type: 'TCP', port: 9000 },
        }}
        onEndpointReplace={jest.fn()}
        onAddEndpoint={() => 'new'}
        onRemoveEndpoint={jest.fn()}
        disabled={false}
        componentEndpoints={componentEndpoints}
      />
    </EntityProvider>,
  );
}

describe('EndpointContent', () => {
  it('shows the Endpoints form with a switch to legacy', () => {
    const setMode = jest.fn();
    renderContent(state({ setMode }));

    expect(
      screen.getByText(/still uses the ComponentType templated routes/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/endpoints-form/)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(setMode).toHaveBeenCalledWith('legacy');
  });

  it("says a release line's rows are prefilled from the main line", () => {
    renderContent(state({ draftedFromMain: 1 }));

    expect(
      screen.getByText(/prefilled from the main line's Endpoints/),
    ).toBeInTheDocument();
  });

  it('shows no prefill notice once the line has Endpoints of its own', () => {
    renderContent(state());

    expect(
      screen.queryByText(/prefilled from the main line's Endpoints/),
    ).not.toBeInTheDocument();
  });

  it('keeps a protocol no type serves project-scoped in the Endpoints form', () => {
    renderContent(state());

    expect(
      screen.getByText(/No endpoint type is allowed for TCP/),
    ).toBeInTheDocument();
  });

  it('shows the legacy form with a switch to Endpoints', () => {
    const setMode = jest.fn();
    renderContent(state({ mode: 'legacy', initialMode: 'legacy', setMode }));

    expect(
      screen.getByText(
        /deprecated in favour of the new Endpoint implementation/,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('legacy-form')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Migrate' }));
    expect(setMode).toHaveBeenCalledWith('endpoints');
  });

  it('opens the Endpoints form even when the ComponentType allows no Endpoint types', () => {
    const setMode = jest.fn();
    renderContent(
      state({ allowedEndpoints: [], canUseEndpoints: false, setMode }),
    );

    expect(
      screen.getByText(/endpoints are reachable within the project only/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/endpoints-form/)).toHaveLength(2);
    expect(
      screen.getAllByText(/allows no Endpoint types, so this endpoint stays/),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(setMode).toHaveBeenCalledWith('legacy');
  });

  it('offers no migration for legacy endpoints without Endpoint types', () => {
    renderContent(
      state({
        mode: 'legacy',
        initialMode: 'legacy',
        allowedEndpoints: [],
        canUseEndpoints: false,
      }),
    );

    expect(
      screen.getByText(/a platform engineer must allow Endpoint types/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Migrate|Switch/ }),
    ).not.toBeInTheDocument();
  });

  it('switches back to Endpoints from legacy without Endpoint types', () => {
    renderContent(
      state({
        mode: 'legacy',
        initialMode: 'endpoints',
        allowedEndpoints: [],
        canUseEndpoints: false,
      }),
    );

    expect(
      screen.getByRole('button', { name: 'Switch to Endpoints' }),
    ).toBeInTheDocument();
  });

  it('says when there are no endpoints', () => {
    render(
      <EntityProvider entity={mockComponentEntity()}>
        <EndpointContent
          endpoints={{}}
          onEndpointReplace={jest.fn()}
          onAddEndpoint={() => 'new'}
          onRemoveEndpoint={jest.fn()}
          disabled={false}
          componentEndpoints={state()}
        />
      </EntityProvider>,
    );
    expect(screen.getByText('No endpoints.')).toBeInTheDocument();
  });

  it('shows type and parameters read-only until the row is edited', () => {
    renderContent(state());
    expect(screen.getAllByText('details-read-only')).toHaveLength(2);
  });

  it('puts back the type and parameters when an edit is cancelled', () => {
    const restoreChoice = jest.fn();
    const choice = { type: 'ClusterEndpointType/http-route', parameters: {} };
    renderContent(state({ restoreChoice, choices: { api: choice } }));

    fireEvent.click(screen.getByRole('button', { name: 'edit api' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel api' }));
    expect(restoreChoice).toHaveBeenCalledWith('api', choice);
  });
});
