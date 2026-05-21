import { render, screen } from '@testing-library/react';
import { SetupCard } from './SetupCard';

jest.mock('./LoadingSkeleton', () => ({
  LoadingSkeleton: ({ variant }: { variant: string }) => (
    <div data-testid={`loading-skeleton-${variant}`} />
  ),
}));

describe('SetupCard (compact canvas tile)', () => {
  it('shows the loading skeleton while no environments are loaded yet', () => {
    render(
      <SetupCard
        loading
        environmentsExist={false}
        isWorkloadEditorSupported
        onConfigureWorkload={jest.fn()}
      />,
    );

    expect(screen.getByTestId('loading-skeleton-setup')).toBeInTheDocument();
    expect(screen.queryByText('Releases & deployment')).not.toBeInTheDocument();
  });

  it('shows the title and hint once loaded', () => {
    render(
      <SetupCard
        loading={false}
        environmentsExist
        isWorkloadEditorSupported
        onConfigureWorkload={jest.fn()}
      />,
    );

    expect(screen.getByText('Set up')).toBeInTheDocument();
    expect(screen.getByText('Releases & deployment')).toBeInTheDocument();
  });
});
