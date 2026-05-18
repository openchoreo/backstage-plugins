import { render, screen, within } from '@testing-library/react';
import { ResourceDependencyDisplay } from './ResourceDependencyDisplay';

describe('ResourceDependencyDisplay', () => {
  it('renders the ref name and a Resource type chip', () => {
    render(
      <ResourceDependencyDisplay
        dependency={{
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
        }}
      />,
    );

    expect(screen.getByText('orders-db')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();
  });

  it('lists envBindings as "output → target" rows', () => {
    render(
      <ResourceDependencyDisplay
        dependency={{
          ref: 'orders-db',
          envBindings: {
            host: 'DB_HOST',
            password: 'DB_PASSWORD',
          },
        }}
      />,
    );

    const row = screen.getByTestId('resource-dependency-row');
    expect(row.textContent).toContain('host→DB_HOST');
    expect(row.textContent).toContain('password→DB_PASSWORD');
    expect(within(row).getByText('Env bindings (2)')).toBeInTheDocument();
  });

  it('lists fileBindings under their own header', () => {
    render(
      <ResourceDependencyDisplay
        dependency={{
          ref: 'orders-db',
          fileBindings: { password: '/etc/db/password' },
        }}
      />,
    );

    const row = screen.getByTestId('resource-dependency-row');
    expect(within(row).getByText('File bindings (1)')).toBeInTheDocument();
    expect(row.textContent).toContain('password→/etc/db/password');
  });

  it('shows None when a bindings section is empty', () => {
    render(
      <ResourceDependencyDisplay
        dependency={{
          ref: 'orders-db',
          envBindings: { host: 'DB_HOST' },
          // no fileBindings
        }}
      />,
    );

    expect(screen.getByText('Env bindings (1)')).toBeInTheDocument();
    expect(screen.getByText('File bindings (0)')).toBeInTheDocument();
    // Empty fileBindings section renders the placeholder.
    expect(screen.getAllByText('None').length).toBeGreaterThan(0);
  });

  it('renders both None when bindings are entirely absent', () => {
    render(<ResourceDependencyDisplay dependency={{ ref: 'orders-db' }} />);
    expect(screen.getAllByText('None').length).toBe(2);
  });
});
