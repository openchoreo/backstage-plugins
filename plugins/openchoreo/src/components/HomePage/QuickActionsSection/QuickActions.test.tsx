import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';

const mockUseComponentCreatePermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useComponentCreatePermission: () => mockUseComponentCreatePermission(),
}));

import { QuickActionsSection } from './QuickActions';

describe('QuickActionsSection', () => {
  beforeEach(() => {
    mockUseComponentCreatePermission.mockReturnValue({
      canCreate: true,
      loading: false,
    });
  });

  it('renders the heading and all quick actions by default', async () => {
    await renderInTestApp(<QuickActionsSection />);

    expect(
      screen.getByRole('heading', { name: 'Quick Actions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create Component')).toBeInTheDocument();
    expect(screen.getByText('View My Projects')).toBeInTheDocument();
    expect(screen.getByText('View My Components')).toBeInTheDocument();
    expect(screen.getByText('Browse Templates')).toBeInTheDocument();
  });

  it('hides the heading when hideTitle is set', async () => {
    await renderInTestApp(<QuickActionsSection hideTitle />);

    expect(
      screen.queryByRole('heading', { name: 'Quick Actions' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Create Component')).toBeInTheDocument();
  });

  it('renders Create Component as a link when the user can create', async () => {
    await renderInTestApp(<QuickActionsSection />);

    expect(screen.getByText('Create Component').closest('a')).not.toBeNull();
  });

  it('disables the Create Component link when the user lacks permission', async () => {
    mockUseComponentCreatePermission.mockReturnValue({
      canCreate: false,
      loading: false,
    });
    await renderInTestApp(<QuickActionsSection />);

    // Disabled action renders as a non-link; the others stay links.
    expect(screen.getByText('Create Component').closest('a')).toBeNull();
    expect(screen.getByText('View My Projects').closest('a')).not.toBeNull();
  });
});
