import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReleaseBindingDetailTabs } from './ReleaseBindingDetailTabs';

// Mock design-system YamlViewer
jest.mock('@openchoreo/backstage-design-system', () => ({
  YamlViewer: ({ value }: { value: string }) => (
    <pre data-testid="yaml-viewer">{value}</pre>
  ),
}));

// ---- Tests ----

describe('ReleaseBindingDetailTabs', () => {
  describe('Summary tab — legacy flat format', () => {
    const legacyBinding: Record<string, unknown> = {
      name: 'my-binding',
      releaseName: 'my-release',
      environment: 'development',
      status: 'Ready',
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          reason: 'AllReady',
          message: 'All resources ready',
          lastTransitionTime: '2026-03-01T12:00:00Z',
        },
      ],
    };

    it('renders release name', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={legacyBinding} />);

      expect(screen.getByText('Component Release')).toBeInTheDocument();
      expect(screen.getByText('my-release')).toBeInTheDocument();
    });

    it('renders status chip', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={legacyBinding} />);

      // "Status" appears as both a property key and table column header
      expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
      // The status value chip shows "Ready"
      expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(1);
    });

    it('renders environment', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={legacyBinding} />);

      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByText('development')).toBeInTheDocument();
    });

    it('renders conditions table with correct columns', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={legacyBinding} />);

      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Reason')).toBeInTheDocument();
      expect(screen.getByText('Message')).toBeInTheDocument();
      expect(screen.getByText('Last Transition')).toBeInTheDocument();
    });

    it('renders condition row data', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={legacyBinding} />);

      // "Ready" appears as: status value chip, condition type cell, condition status chip (True)
      expect(screen.getAllByText('Ready').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('AllReady')).toBeInTheDocument();
      expect(screen.getByText('All resources ready')).toBeInTheDocument();
    });
  });

  describe('Summary tab — new K8s API format', () => {
    const newApiBinding: Record<string, unknown> = {
      metadata: { name: 'new-binding' },
      spec: {
        releaseName: 'new-release',
        environment: 'staging',
        state: 'Active',
      },
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'True',
            reason: 'Reconciled',
            message: 'Successfully reconciled',
            lastTransitionTime: '2026-04-01T08:00:00Z',
          },
          {
            type: 'Deployed',
            status: 'True',
            reason: 'AllDeployed',
            message: 'All resources deployed',
          },
        ],
      },
    };

    it('reads releaseName from spec', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={newApiBinding} />);

      expect(screen.getByText('new-release')).toBeInTheDocument();
    });

    it('reads environment from spec', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={newApiBinding} />);

      expect(screen.getByText('staging')).toBeInTheDocument();
    });

    it('reads status from spec.state', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={newApiBinding} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('reads conditions from status.conditions', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={newApiBinding} />);

      expect(screen.getByText('Reconciled')).toBeInTheDocument();
      expect(screen.getByText('AllDeployed')).toBeInTheDocument();
    });

    it('renders multiple condition rows', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={newApiBinding} />);

      expect(screen.getByText('Deployed')).toBeInTheDocument();
      expect(screen.getByText('All resources deployed')).toBeInTheDocument();
    });
  });

  describe('Summary tab — null binding data', () => {
    it('renders without crashing when binding data is null', () => {
      render(<ReleaseBindingDetailTabs releaseBindingData={null} />);

      // Should not show release name, status, or environment
      expect(screen.queryByText('Component Release')).not.toBeInTheDocument();
      expect(screen.queryByText('Status')).not.toBeInTheDocument();
      expect(screen.queryByText('Environment')).not.toBeInTheDocument();
    });
  });

  describe('Summary tab — missing optional fields', () => {
    it('hides release name when not present', () => {
      render(
        <ReleaseBindingDetailTabs releaseBindingData={{ status: 'Ready' }} />,
      );

      expect(screen.queryByText('Component Release')).not.toBeInTheDocument();
    });

    it('shows dash for condition fields that are undefined', () => {
      render(
        <ReleaseBindingDetailTabs
          releaseBindingData={{
            conditions: [{ type: 'Ready', status: 'True' }],
          }}
        />,
      );

      // reason and message should show '-' when not provided
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Definition tab', () => {
    it('shows YAML viewer with binding data when Definition tab is clicked', async () => {
      const user = userEvent.setup();
      const binding = { name: 'test-binding', status: 'Ready' };

      render(<ReleaseBindingDetailTabs releaseBindingData={binding} />);

      await user.click(screen.getByText('Definition'));

      const viewer = screen.getByTestId('yaml-viewer');
      expect(viewer).toBeInTheDocument();
      expect(viewer.textContent).toContain('test-binding');
    });

    it('shows empty state when binding data is null on Definition tab', async () => {
      const user = userEvent.setup();

      render(<ReleaseBindingDetailTabs releaseBindingData={null} />);

      await user.click(screen.getByText('Definition'));

      expect(
        screen.getByText('No release binding definition available'),
      ).toBeInTheDocument();
    });
  });
});
