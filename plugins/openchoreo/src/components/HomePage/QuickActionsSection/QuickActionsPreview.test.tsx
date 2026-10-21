import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';

const mockUseComponentCreatePermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useComponentCreatePermission: () => mockUseComponentCreatePermission(),
}));

import { QuickActionsSectionPreview } from './QuickActions';

describe('QuickActionsSectionPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows every quick action', async () => {
    await renderInTestApp(<QuickActionsSectionPreview hideTitle />);

    expect(screen.getByText('Create Component')).toBeInTheDocument();
    expect(screen.getByText('View My Projects')).toBeInTheDocument();
    expect(screen.getByText('View My Components')).toBeInTheDocument();
    expect(screen.getByText('Browse Templates')).toBeInTheDocument();
  });

  it('shows Create Component as available without checking permissions', async () => {
    await renderInTestApp(<QuickActionsSectionPreview />);

    expect(screen.getByText('Create Component').closest('a')).not.toBeNull();
    expect(mockUseComponentCreatePermission).not.toHaveBeenCalled();
  });
});
