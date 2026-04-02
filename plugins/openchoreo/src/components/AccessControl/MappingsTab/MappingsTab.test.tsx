import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MappingsTab } from './MappingsTab';

// ---- Mocks ----

jest.mock('../ScopeDropdown', () => ({
  ScopeDropdown: ({ value, onChange, clusterLabel, namespaceLabel }: any) => (
    <div data-testid="scope-dropdown">
      <span data-testid="scope-value">{value}</span>
      <button
        data-testid="switch-to-cluster"
        onClick={() => onChange('cluster')}
      >
        {clusterLabel}
      </button>
      <button
        data-testid="switch-to-namespace"
        onClick={() => onChange('namespace')}
      >
        {namespaceLabel}
      </button>
    </div>
  ),
}));

jest.mock('./ClusterRoleBindingsContent', () => ({
  ClusterRoleBindingsContent: () => (
    <div data-testid="cluster-bindings-content">ClusterRoleBindingsContent</div>
  ),
}));

jest.mock('./NamespaceRoleBindingsContent', () => ({
  NamespaceRoleBindingsContent: ({ selectedNamespace }: any) => (
    <div data-testid="namespace-bindings-content">
      NamespaceRoleBindingsContent:{selectedNamespace}
    </div>
  ),
}));

jest.mock('../RolesTab/NamespaceSelector', () => ({
  NamespaceSelector: ({ value, onChange }: any) => (
    <select
      data-testid="namespace-selector"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Select</option>
      <option value="ns-1">ns-1</option>
    </select>
  ),
}));

// ---- Helpers ----

function renderTab() {
  return render(
    <MemoryRouter>
      <MappingsTab />
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('MappingsTab', () => {
  it('defaults to cluster scope with ClusterRoleBindingsContent visible', () => {
    renderTab();

    expect(screen.getByTestId('cluster-bindings-content')).toBeInTheDocument();
    expect(
      screen.queryByTestId('namespace-bindings-content'),
    ).not.toBeInTheDocument();
  });

  it('does not show namespace selector in cluster scope', () => {
    renderTab();

    expect(
      screen.queryByTestId('namespace-selector'),
    ).not.toBeInTheDocument();
  });

  it('shows scope dropdown with correct labels', () => {
    renderTab();

    expect(screen.getByText('Cluster Role Bindings')).toBeInTheDocument();
    expect(screen.getByText('Namespace Role Bindings')).toBeInTheDocument();
  });

  it('switches to namespace scope and shows NamespaceRoleBindingsContent', async () => {
    const user = userEvent.setup();

    renderTab();

    await user.click(screen.getByTestId('switch-to-namespace'));

    expect(
      screen.getByTestId('namespace-bindings-content'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cluster-bindings-content'),
    ).not.toBeInTheDocument();
  });

  it('shows namespace selector when in namespace scope', async () => {
    const user = userEvent.setup();

    renderTab();

    await user.click(screen.getByTestId('switch-to-namespace'));

    expect(screen.getByTestId('namespace-selector')).toBeInTheDocument();
  });

  it('switches back to cluster scope', async () => {
    const user = userEvent.setup();

    renderTab();

    await user.click(screen.getByTestId('switch-to-namespace'));
    expect(
      screen.getByTestId('namespace-bindings-content'),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('switch-to-cluster'));
    expect(screen.getByTestId('cluster-bindings-content')).toBeInTheDocument();
  });
});
