import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceMiniEnvironmentNode } from './ResourceMiniEnvironmentNode';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: ({ status }: any) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

function bound(): ResourceEnvironment {
  return {
    name: 'dev',
    bindingName: 'b-dev',
    resourceRelease: 'rel-abc',
    status: 'Ready',
    latestRelease: 'rel-abc',
  };
}

describe('ResourceMiniEnvironmentNode', () => {
  it('renders env name + success badge + release for a bound env', () => {
    render(
      <ResourceMiniEnvironmentNode
        env={bound()}
        selected={false}
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge').textContent).toBe('active');
    expect(screen.getByText('rel-abc')).toBeInTheDocument();
  });

  it('shows the not-deployed badge and message when no binding', () => {
    render(
      <ResourceMiniEnvironmentNode
        env={{ name: 'staging' }}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId('status-badge').textContent).toBe('not-deployed');
    expect(screen.getByText(/not deployed/i)).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(
      <ResourceMiniEnvironmentNode
        env={bound()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /select environment dev/i }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('marks itself aria-pressed when selected', () => {
    render(
      <ResourceMiniEnvironmentNode
        env={bound()}
        selected
        onSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /select environment dev/i }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('handles Enter and Space keys to select', () => {
    const onSelect = jest.fn();
    render(
      <ResourceMiniEnvironmentNode
        env={bound()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    const tile = screen.getByRole('button', { name: /select environment dev/i });
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  describe('drift badge', () => {
    it('renders a "Behind" badge when binding is behind latest release', () => {
      render(
        <ResourceMiniEnvironmentNode
          env={{
            name: 'dev',
            bindingName: 'b-dev',
            resourceRelease: 'rel-old',
            status: 'Ready',
            latestRelease: 'rel-new',
          }}
          selected={false}
          onSelect={() => {}}
        />,
      );
      expect(screen.getByText('Behind')).toBeInTheDocument();
    });

    it('does not render the badge when at latest', () => {
      render(
        <ResourceMiniEnvironmentNode
          env={bound()}
          selected={false}
          onSelect={() => {}}
        />,
      );
      expect(screen.queryByText('Behind')).toBeNull();
    });

    it('does not render the badge when there is no binding', () => {
      render(
        <ResourceMiniEnvironmentNode
          env={{ name: 'staging', latestRelease: 'rel-1' }}
          selected={false}
          onSelect={() => {}}
        />,
      );
      expect(screen.queryByText('Behind')).toBeNull();
    });
  });
});
