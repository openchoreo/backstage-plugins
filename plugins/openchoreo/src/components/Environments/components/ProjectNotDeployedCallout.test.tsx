import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { ProjectNotDeployedCallout } from './ProjectNotDeployedCallout';

const renderCallout = (
  props: Partial<React.ComponentProps<typeof ProjectNotDeployedCallout>> = {},
  entityOverrides = {},
) =>
  render(
    <MemoryRouter>
      <EntityProvider
        entity={mockComponentEntity({
          namespace: 'default',
          annotations: { 'openchoreo.io/project': 'shop' },
          ...entityOverrides,
        })}
      >
        <ProjectNotDeployedCallout
          envName="Development"
          envResourceName="development"
          variant="setup"
          {...props}
        />
      </EntityProvider>
    </MemoryRouter>,
  );

describe('ProjectNotDeployedCallout', () => {
  it('links to the project Deploy tab in a new tab, deep-linked at the env', () => {
    renderCallout();
    const link = screen.getByRole('link', {
      name: /deploy project/i,
    });
    expect(link).toHaveAttribute(
      'href',
      '/catalog/default/system/shop/deploy?env=development&intent=deploy',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('names the project and env in the setup copy', () => {
    renderCallout({ variant: 'setup' });
    expect(screen.getByText('Project not deployed')).toBeInTheDocument();
    expect(
      screen.getByText(/shop hasn't been deployed to Development/i),
    ).toBeInTheDocument();
  });

  it('uses promote-specific copy', () => {
    renderCallout({ variant: 'promote', envName: 'Staging' });
    expect(
      screen.getByText(/isn't deployed to Staging\. Deploy the project there/i),
    ).toBeInTheDocument();
  });

  it('uses recovery copy in the error dialog', () => {
    renderCallout({ variant: 'error-dialog' });
    expect(
      screen.getByText(/recover automatically on the next reconcile/i),
    ).toBeInTheDocument();
  });

  it('falls back to the env display name in the link when no resource name', () => {
    renderCallout({ envResourceName: undefined, envName: 'Development' });
    expect(
      screen.getByRole('link', { name: /deploy project/i }),
    ).toHaveAttribute(
      'href',
      '/catalog/default/system/shop/deploy?env=development&intent=deploy',
    );
  });

  it('disables the deploy action when the component has no project annotation', () => {
    renderCallout({}, { annotations: {} });
    const control = screen.getByText(/deploy project/i).closest('a, button');
    expect(control).toHaveClass('Mui-disabled');
  });
});
