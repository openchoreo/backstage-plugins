import { render, screen } from '@testing-library/react';
import { FeatureGate } from './FeatureGate';

// Mock the useOpenChoreoFeatures hook to control feature flags in tests
const mockUseOpenChoreoFeatures = jest.fn();
jest.mock('../../hooks/useOpenChoreoFeatures', () => ({
  useOpenChoreoFeatures: () => mockUseOpenChoreoFeatures(),
}));

describe('FeatureGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows children when feature is enabled', () => {
    mockUseOpenChoreoFeatures.mockReturnValue({
      workflows: { enabled: true },
    });

    render(
      <FeatureGate feature="workflows">
        <div>Workflows Content</div>
      </FeatureGate>,
    );

    expect(screen.getByText('Workflows Content')).toBeInTheDocument();
  });

  it('hides children when feature is disabled', () => {
    mockUseOpenChoreoFeatures.mockReturnValue({
      workflows: { enabled: false },
    });

    render(
      <FeatureGate feature="workflows">
        <div>Workflows Content</div>
      </FeatureGate>,
    );

    expect(screen.queryByText('Workflows Content')).not.toBeInTheDocument();
  });

  it('shows children by default (features default to enabled)', () => {
    // Return empty object so feature lookup is undefined, triggering ?? true default
    mockUseOpenChoreoFeatures.mockReturnValue({});

    render(
      <FeatureGate feature="workflows">
        <div>Workflows Content</div>
      </FeatureGate>,
    );

    expect(screen.getByText('Workflows Content')).toBeInTheDocument();
  });
});
