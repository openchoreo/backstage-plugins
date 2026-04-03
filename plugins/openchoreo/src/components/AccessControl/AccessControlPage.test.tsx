import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessControlContent } from './AccessControlPage';

// ---- Mocks ----

jest.mock('@openchoreo/backstage-design-system', () => ({
  VerticalTabNav: ({ tabs, children }: any) => (
    <div data-testid="vertical-tab-nav">
      {tabs.map((t: any) => (
        <span key={t.id} data-testid={`tab-${t.id}`}>
          {t.label}
        </span>
      ))}
      {children}
    </div>
  ),
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
  WarningPanel: ({ title, children }: any) => (
    <div data-testid="warning-panel" data-title={title}>
      {children}
    </div>
  ),
}));

const mockUseRolePermissions = jest.fn();
const mockUseClusterRolePermissions = jest.fn();
const mockUseRoleMappingPermissions = jest.fn();
const mockUseClusterRoleMappingPermissions = jest.fn();

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useRolePermissions: () => mockUseRolePermissions(),
  useClusterRolePermissions: () => mockUseClusterRolePermissions(),
  useRoleMappingPermissions: () => mockUseRoleMappingPermissions(),
  useClusterRoleMappingPermissions: () =>
    mockUseClusterRoleMappingPermissions(),
}));

const mockUseClusterRoles = jest.fn();
jest.mock('./hooks', () => ({
  useClusterRoles: () => mockUseClusterRoles(),
}));

jest.mock('./RolesTab', () => ({
  RolesTab: () => <div data-testid="roles-tab">RolesTab</div>,
}));

jest.mock('./MappingsTab', () => ({
  MappingsTab: () => <div data-testid="mappings-tab">MappingsTab</div>,
}));

jest.mock('./ActionsTab', () => ({
  ActionsTab: () => <div data-testid="actions-tab">ActionsTab</div>,
}));

// ---- Helpers ----

const grantedPerm = { canView: true, loading: false };
const deniedPerm = { canView: false, loading: false };
const loadingPerm = { canView: false, loading: true };

function setAllPermissions(
  overrides: {
    nsRoles?: typeof grantedPerm;
    clusterRoles?: typeof grantedPerm;
    nsMappings?: typeof grantedPerm;
    clusterMappings?: typeof grantedPerm;
  } = {},
) {
  mockUseRolePermissions.mockReturnValue(overrides.nsRoles ?? grantedPerm);
  mockUseClusterRolePermissions.mockReturnValue(
    overrides.clusterRoles ?? grantedPerm,
  );
  mockUseRoleMappingPermissions.mockReturnValue(
    overrides.nsMappings ?? grantedPerm,
  );
  mockUseClusterRoleMappingPermissions.mockReturnValue(
    overrides.clusterMappings ?? grantedPerm,
  );
}

function renderContent() {
  return render(
    <MemoryRouter>
      <AccessControlContent />
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('AccessControlContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseClusterRoles.mockReturnValue({
      roles: [],
      loading: false,
      error: null,
    });
    setAllPermissions();
  });

  it('shows progress when permissions are loading', () => {
    setAllPermissions({ nsRoles: loadingPerm });

    renderContent();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows authorization disabled warning when authz is disabled', () => {
    mockUseClusterRoles.mockReturnValue({
      roles: [],
      loading: false,
      error: new Error('authorization is disabled'),
    });

    renderContent();

    expect(screen.getByTestId('warning-panel')).toHaveAttribute(
      'data-title',
      'Authorization is Disabled',
    );
    expect(
      screen.getByText(/Policy management operations are not available/),
    ).toBeInTheDocument();
  });

  it('shows Roles tab when user has role view permissions', () => {
    renderContent();

    expect(screen.getByTestId('tab-roles')).toHaveTextContent('Roles');
  });

  it('shows Role Bindings tab when user has mapping permissions', () => {
    renderContent();

    expect(screen.getByTestId('tab-mappings')).toHaveTextContent(
      'Role Bindings',
    );
  });

  it('always shows Actions tab', () => {
    setAllPermissions({
      nsRoles: deniedPerm,
      clusterRoles: deniedPerm,
      nsMappings: deniedPerm,
      clusterMappings: deniedPerm,
    });

    renderContent();

    expect(screen.getByTestId('tab-actions')).toHaveTextContent('Actions');
  });

  it('hides Roles tab when user has no role view permissions', () => {
    setAllPermissions({
      nsRoles: deniedPerm,
      clusterRoles: deniedPerm,
    });

    renderContent();

    expect(screen.queryByTestId('tab-roles')).not.toBeInTheDocument();
  });

  it('hides Role Bindings tab when user has no mapping permissions', () => {
    setAllPermissions({
      nsMappings: deniedPerm,
      clusterMappings: deniedPerm,
    });

    renderContent();

    expect(screen.queryByTestId('tab-mappings')).not.toBeInTheDocument();
  });

  it('shows only Actions tab when all permissions denied', () => {
    setAllPermissions({
      nsRoles: deniedPerm,
      clusterRoles: deniedPerm,
      nsMappings: deniedPerm,
      clusterMappings: deniedPerm,
    });

    renderContent();

    expect(screen.queryByTestId('tab-roles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-mappings')).not.toBeInTheDocument();
    expect(screen.getByTestId('tab-actions')).toBeInTheDocument();
  });
});
