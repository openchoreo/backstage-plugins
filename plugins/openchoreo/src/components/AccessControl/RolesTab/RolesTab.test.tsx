import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RolesTab } from './RolesTab';

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

jest.mock('./ClusterRolesContent', () => ({
  ClusterRolesContent: () => (
    <div data-testid="cluster-roles-content">ClusterRolesContent</div>
  ),
}));

jest.mock('./NamespaceRolesContent', () => ({
  NamespaceRolesContent: ({ selectedNamespace }: any) => (
    <div data-testid="namespace-roles-content">
      NamespaceRolesContent:{selectedNamespace}
    </div>
  ),
}));

jest.mock('./NamespaceSelector', () => ({
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
      <RolesTab />
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('RolesTab', () => {
  it('defaults to cluster scope with ClusterRolesContent visible', () => {
    renderTab();

    expect(screen.getByTestId('cluster-roles-content')).toBeInTheDocument();
    expect(
      screen.queryByTestId('namespace-roles-content'),
    ).not.toBeInTheDocument();
  });

  it('does not show namespace selector in cluster scope', () => {
    renderTab();

    expect(screen.queryByTestId('namespace-selector')).not.toBeInTheDocument();
  });

  it('shows scope dropdown with correct labels', () => {
    renderTab();

    expect(screen.getByText('Cluster Roles')).toBeInTheDocument();
    expect(screen.getByText('Namespace Roles')).toBeInTheDocument();
  });

  it('switches to namespace scope and shows NamespaceRolesContent', async () => {
    const user = userEvent.setup();

    renderTab();

    await user.click(screen.getByTestId('switch-to-namespace'));

    expect(screen.getByTestId('namespace-roles-content')).toBeInTheDocument();
    expect(
      screen.queryByTestId('cluster-roles-content'),
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
    expect(screen.getByTestId('namespace-roles-content')).toBeInTheDocument();

    await user.click(screen.getByTestId('switch-to-cluster'));
    expect(screen.getByTestId('cluster-roles-content')).toBeInTheDocument();
  });
});
