import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResourceMiniEnvironmentNode } from './ResourceMiniEnvironmentNode';
import {
  ResourceEnvironmentsProvider,
  type ResourceEnvironmentsContextValue,
} from './ResourceEnvironmentsContext';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  formatRelativeTime: () => 'just now',
}));

function bound(): ResourceEnvironment {
  return {
    name: 'dev',
    resourceName: 'dev',
    bindingName: 'b-dev',
    resourceRelease: 'rel-abc',
    status: 'Ready',
    latestRelease: 'rel-abc',
    lastDeployed: '2026-01-01T00:00:00Z',
  };
}

function makeCtx(
  overrides: Partial<ResourceEnvironmentsContextValue> = {},
): ResourceEnvironmentsContextValue {
  return {
    environments: [],
    loading: false,
    refetch: jest.fn(),
    selectedEnvName: null,
    setSelectedEnvName: jest.fn(),
    pendingAction: null,
    onPromote: jest.fn(),
    onUndeployRequest: jest.fn(),
    onRetainPolicyChange: jest.fn(),
    ...overrides,
  };
}

function renderTile(
  env: ResourceEnvironment,
  selected = false,
  onSelect: () => void = () => {},
  ctxOverrides: Partial<ResourceEnvironmentsContextValue> = {},
) {
  return render(
    <MemoryRouter>
      <ResourceEnvironmentsProvider value={makeCtx(ctxOverrides)}>
        <ResourceMiniEnvironmentNode
          env={env}
          selected={selected}
          onSelect={onSelect}
        />
      </ResourceEnvironmentsProvider>
    </MemoryRouter>,
  );
}

describe('ResourceMiniEnvironmentNode', () => {
  it('renders env name + active badge + deployed timestamp for a bound env', () => {
    renderTile(bound());

    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge').textContent).toBe('active');
    expect(screen.getByText(/deployed/i)).toBeInTheDocument();
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('shows the not-deployed badge and omits timestamp when no binding', () => {
    renderTile({ name: 'staging' });
    expect(screen.getByTestId('status-badge').textContent).toBe('not-deployed');
    expect(screen.queryByText(/deployed:/i)).toBeNull();
  });

  it('calls onSelect when the tile body is clicked', () => {
    const onSelect = jest.fn();
    renderTile(bound(), false, onSelect);
    fireEvent.click(
      screen.getByRole('button', { name: /select environment dev/i }),
    );
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks itself aria-pressed when selected', () => {
    renderTile(bound(), true);
    expect(
      screen.getByRole('button', { name: /select environment dev/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('handles Enter and Space keys to select', () => {
    const onSelect = jest.fn();
    renderTile(bound(), false, onSelect);
    const tile = screen.getByRole('button', {
      name: /select environment dev/i,
    });
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  describe('actions menu', () => {
    it('opens the menu without selecting the tile', () => {
      const onSelect = jest.fn();
      renderTile(bound(), false, onSelect);

      fireEvent.click(
        screen.getByRole('button', { name: /actions for dev/i }),
      );

      expect(
        screen.getByRole('menuitem', { name: /refresh/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('menuitem', { name: /configure overrides/i }),
      ).toBeInTheDocument();
      // The wrapping tile's onSelect must not fire when opening the menu.
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('invokes refetch from context when Refresh is chosen', () => {
      const refetch = jest.fn();
      renderTile(bound(), false, () => {}, { refetch });

      fireEvent.click(
        screen.getByRole('button', { name: /actions for dev/i }),
      );
      fireEvent.click(screen.getByRole('menuitem', { name: /refresh/i }));

      expect(refetch).toHaveBeenCalled();
    });

    it('disables Configure overrides when there is no binding', () => {
      renderTile({ name: 'staging' });
      fireEvent.click(
        screen.getByRole('button', { name: /actions for staging/i }),
      );
      expect(
        screen.getByRole('menuitem', { name: /configure overrides/i }),
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
