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
  it('shows the Endpoints form, with no way to switch forms', () => {
    renderContent(state());

    expect(screen.getAllByText(/endpoints-form/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Switch|Migrate/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
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

  it('shows the legacy form for a ComponentType kept on legacy endpoints', () => {
    renderContent(state({ mode: 'legacy' }));

    expect(screen.getAllByText('legacy-form')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Switch|Migrate/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps every endpoint project-scoped when the ComponentType allows no Endpoint types', () => {
    renderContent(state({ allowedEndpoints: [], canUseEndpoints: false }));

    expect(screen.getAllByText(/endpoints-form/)).toHaveLength(2);
    expect(
      screen.getAllByText(/allows no Endpoint types, so this endpoint stays/),
    ).toHaveLength(2);
  });

  it("reports a ComponentType that couldn't be read", () => {
    renderContent(state({ mode: 'legacy', loadError: 'forbidden' }));

    expect(
      screen.getByText(/Could not load the component's Endpoints: forbidden/),
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
