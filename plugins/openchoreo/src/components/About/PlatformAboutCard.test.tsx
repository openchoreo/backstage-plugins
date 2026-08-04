import { render, screen, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { PlatformAboutCard } from './PlatformAboutCard';

const versionInfo = {
  name: 'openchoreo-api',
  version: 'v1.2.0',
  gitRevision: 'abc12345',
  buildTime: '2025-01-06T10:00:00Z',
  goOS: 'linux',
  goArch: 'amd64',
  goVersion: 'go1.24.2',
};

const mockClient = {
  getPlatformVersion: jest.fn(),
};

function renderPlatformAboutCard() {
  const Wrapper = createQueryWrapper([
    [openChoreoClientApiRef, mockClient as any],
  ]);
  return render(
    <Wrapper>
      <PlatformAboutCard />
    </Wrapper>,
  );
}

describe('PlatformAboutCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the platform version details', async () => {
    mockClient.getPlatformVersion.mockResolvedValue(versionInfo);

    renderPlatformAboutCard();

    await waitFor(() => {
      expect(screen.getByText('v1.2.0')).toBeInTheDocument();
    });
    expect(screen.getByText('abc12345')).toBeInTheDocument();
    expect(screen.getByText('openchoreo-api')).toBeInTheDocument();
    expect(screen.getByText('linux/amd64')).toBeInTheDocument();
    expect(screen.getByText('go1.24.2')).toBeInTheDocument();
  });

  it('renders "unknown" for not-set build values', async () => {
    mockClient.getPlatformVersion.mockResolvedValue({
      ...versionInfo,
      version: 'not-set',
      gitRevision: 'not-set',
      buildTime: 'not-set',
    });

    renderPlatformAboutCard();

    await waitFor(() => {
      expect(screen.getAllByText('unknown').length).toBeGreaterThanOrEqual(3);
    });
  });

  it('renders an error state when the fetch fails', async () => {
    mockClient.getPlatformVersion.mockRejectedValue(
      new Error('upstream unavailable'),
    );

    renderPlatformAboutCard();

    await waitFor(
      () => {
        expect(
          screen.getByText('Failed to fetch platform version'),
        ).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText('upstream unavailable')).toBeInTheDocument();
  });
});
