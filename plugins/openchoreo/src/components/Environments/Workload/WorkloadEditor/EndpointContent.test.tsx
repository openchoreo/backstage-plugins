import { render, screen, fireEvent } from '@testing-library/react';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import type { ExposableEndpoint } from '@openchoreo/backstage-plugin-common';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import { EndpointContent } from './EndpointContent';

const mockStartNew = jest.fn();

jest.mock('../WorkloadContext', () => ({
  useWorkloadContext: () => ({ setEditingSection: jest.fn() }),
}));

// The list stub shows which form is rendered: the Endpoints form passes
// row details and per-row editor settings, the legacy form neither.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  endpointProtocolChanges: (_endpoint: any, protocol: string) => [
    ['protocol', protocol],
    ['type', protocol],
  ],
  useEndpointEditBuffer: () => ({
    isAnyRowEditing: false,
    startNew: mockStartNew,
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
            {
              props.rowEditorProps?.(name, endpoint, false)
                ?.visibilityDisabledReason
            }
            <span>
              protocols {name}:{' '}
              {props
                .rowEditorProps?.(name, endpoint, false)
                ?.protocolOptions?.join(',') ?? 'any'}
            </span>
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
      <button
        type="button"
        onClick={() =>
          props.onAddRequest
            ? props.onAddRequest()
            : props.editBuffer.startNew(props.onAddEndpoint())
        }
      >
        add
      </button>
    </div>
  ),
}));

jest.mock('./EndpointExposure', () => ({
  chosenEndpointTypeKeys: () => [],
  useEndpointTypeSchemas: () => ({}),
}));

jest.mock('./EndpointTypePicker', () => ({
  useEndpointTypeDetails: () => ({}),
  EndpointTypePicker: (props: any) =>
    props.open ? (
      <div data-testid="type-picker">
        <button
          type="button"
          onClick={() => props.onSelect('ClusterEndpointType/grpc-route')}
        >
          pick grpc-route
        </button>
      </div>
    ) : null,
}));

jest.mock('./ComponentEndpointExposure', () => ({
  ComponentEndpointExposure: (props: any) => (
    <span>{props.editing ? 'details-editable' : 'details-read-only'}</span>
  ),
  ComponentEndpointTypeHeader: () => null,
  DetachedComponentEndpoints: () => null,
  cardEndpointType: (_endpoint: any, form: any, name: string) =>
    form.choices[name]?.type ?? 'none',
}));

const httpRoute = {
  protocols: ['HTTP'],
  ref: { kind: 'ClusterEndpointType', name: 'http-route' },
  default: true,
};
const grpcRoute = {
  protocols: ['gRPC'],
  ref: { kind: 'ClusterEndpointType', name: 'grpc-route' },
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

  it('keeps a card without an Endpoint type within the project', () => {
    renderContent(state());

    expect(
      screen.getAllByText(
        /has no Endpoint type, so it stays within the project/,
      ),
    ).toHaveLength(2);
    expect(screen.getByText('protocols api: any')).toBeInTheDocument();
  });

  it("limits a card to its Endpoint type's protocols", () => {
    renderContent(
      state({
        choices: { api: { type: 'ClusterEndpointType/http-route' } },
      }),
    );

    expect(screen.getByText('protocols api: HTTP')).toBeInTheDocument();
    expect(screen.getByText('protocols raw: any')).toBeInTheDocument();
  });

  it('asks for the Endpoint type first, then opens the card with it', () => {
    const setChoice = jest.fn();
    mockStartNew.mockClear();
    renderContent(
      state({ setChoice, allowedEndpoints: [httpRoute, grpcRoute] }),
    );

    expect(screen.queryByTestId('type-picker')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick grpc-route' }));

    expect(screen.queryByTestId('type-picker')).toBeNull();
    expect(setChoice).toHaveBeenCalledWith('new', {
      type: 'ClusterEndpointType/grpc-route',
    });
    expect(mockStartNew).toHaveBeenCalledWith('new', {
      type: 'gRPC',
      protocol: 'gRPC',
      port: 8080,
      visibility: ['project'],
    });
  });

  it('adds a row straight away in the legacy form', () => {
    mockStartNew.mockClear();
    renderContent(state({ mode: 'legacy' }));

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.queryByTestId('type-picker')).toBeNull();
    expect(mockStartNew).toHaveBeenCalledWith('new');
  });

  it('shows the legacy form for a ComponentType kept on legacy endpoints', () => {
    renderContent(state({ mode: 'legacy' }));

    expect(screen.getAllByText('legacy-form')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Switch|Migrate/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows no form when the ComponentType allows no Endpoints', () => {
    renderContent(
      state({ mode: 'none', allowedEndpoints: [], canUseEndpoints: false }),
    );

    expect(
      screen.getByText(/This component type doesn't allow Endpoints/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('endpoint-list')).toBeNull();
  });

  it('shows no card for a workload endpoint from before Endpoints', () => {
    renderContent(
      state({
        deprecatedRows: {
          // As the workload has it, so unchanged.
          api: {
            type: 'HTTP',
            port: 8080,
            visibility: ['external'],
          } as ExposableEndpoint,
        },
      }),
    );

    // Only the TCP row gets a card; api stays on the workload as it is.
    expect(screen.getAllByText(/endpoints-form/)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'edit api' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'edit raw' }),
    ).toBeInTheDocument();
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
