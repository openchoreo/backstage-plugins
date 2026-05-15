import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinOpsApplyButton } from './FinOpsApplyButton';
import type { FinOpsRemediationAction } from '../../types';

// Mock the shared apply utility
jest.mock('../../utils/applyResourceChange', () => ({
  applyResourceChange: jest.fn(),
}));

import { applyResourceChange } from '../../utils/applyResourceChange';

const mockApplyResourceChange = applyResourceChange as jest.MockedFunction<
  typeof applyResourceChange
>;

// Mock the permission hook
const mockUseFinopsUpdatePermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useFinopsUpdatePermission: () => mockUseFinopsUpdatePermission(),
}));

// Mock Backstage fetchApiRef (used inside FinOpsApplyButton via useApi)
const mockFetch = jest.fn();
jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => ({ fetch: mockFetch }),
  fetchApiRef: {},
}));

const mockFinopsAgentApi = {
  updateActionStatuses: jest.fn(),
};

const chatContext = {
  backendBaseUrl: 'http://backend',
  namespaceName: 'dev',
  environmentName: 'development',
  finopsAgentApi: mockFinopsAgentApi,
};

const revisedAction: FinOpsRemediationAction = {
  description: 'Right-size CPU and memory requests',
  rationale: 'CPU utilization is low',
  status: 'revised',
  change: {
    release_binding: 'my-service-development',
    fields: [
      {
        json_pointer:
          '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
        value: '50m',
      },
    ],
  },
};

function renderButton(
  action: FinOpsRemediationAction = revisedAction,
  props?: Partial<Parameters<typeof FinOpsApplyButton>[0]>,
) {
  return render(
    <FinOpsApplyButton
      reportId="report-123"
      actionIndex={0}
      action={action}
      chatContext={chatContext}
      onApplied={jest.fn()}
      {...props}
    />,
  );
}

describe('FinOpsApplyButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFinopsUpdatePermission.mockReturnValue({
      canUpdateFinops: true,
      loading: false,
      deniedTooltip: '',
    });
    mockApplyResourceChange.mockResolvedValue(undefined);
    mockFinopsAgentApi.updateActionStatuses.mockResolvedValue(undefined);
  });

  describe('initial states from server status', () => {
    it('shows Apply Recommendation button for a revised action', () => {
      renderButton();
      expect(
        screen.getByRole('button', { name: /apply recommendation/i }),
      ).toBeInTheDocument();
    });

    it('shows Applied (disabled) for a server-side applied action', () => {
      renderButton({ ...revisedAction, status: 'applied' });
      const btn = screen.getByRole('button', { name: /applied/i });
      expect(btn).toBeDisabled();
    });

    it('shows Dismissed (disabled) for a server-side dismissed action', () => {
      renderButton({ ...revisedAction, status: 'dismissed' });
      const btn = screen.getByRole('button', { name: /dismissed/i });
      expect(btn).toBeDisabled();
    });
  });

  describe('permission gating', () => {
    it('disables the button when canUpdateFinops is false', () => {
      mockUseFinopsUpdatePermission.mockReturnValue({
        canUpdateFinops: false,
        loading: false,
        deniedTooltip: 'No permission',
      });
      renderButton();
      expect(
        screen.getByRole('button', { name: /apply recommendation/i }),
      ).toBeDisabled();
    });

    it('disables the button while permission is loading', () => {
      mockUseFinopsUpdatePermission.mockReturnValue({
        canUpdateFinops: false,
        loading: true,
        deniedTooltip: '',
      });
      renderButton();
      expect(
        screen.getByRole('button', { name: /apply recommendation/i }),
      ).toBeDisabled();
    });

    it('disables the button when action.change is null', () => {
      renderButton({ ...revisedAction, change: null });
      expect(
        screen.getByRole('button', { name: /apply recommendation/i }),
      ).toBeDisabled();
    });
  });

  describe('successful apply flow', () => {
    it('calls applyResourceChange with correct arguments', async () => {
      renderButton();
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(mockApplyResourceChange).toHaveBeenCalledWith({
          backendBaseUrl: 'http://backend',
          fetchApi: expect.any(Object),
          namespaceName: 'dev',
          change: revisedAction.change,
        }),
      );
    });

    it('calls finopsAgentApi.updateActionStatuses with appliedIndices', async () => {
      renderButton();
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(mockFinopsAgentApi.updateActionStatuses).toHaveBeenCalledWith(
          'report-123',
          { namespaceName: 'dev', environmentName: 'development' },
          { appliedIndices: [0] },
        ),
      );
    });

    it('shows Applied button after successful apply', async () => {
      renderButton();
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /applied/i })).toBeDisabled(),
      );
    });

    it('calls onApplied callback after successful apply', async () => {
      const onApplied = jest.fn();
      renderButton(revisedAction, { onApplied });
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    });

    it('still shows Applied even if updateActionStatuses fails (non-fatal)', async () => {
      mockFinopsAgentApi.updateActionStatuses.mockRejectedValue(
        new Error('network'),
      );
      renderButton();
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /applied/i })).toBeDisabled(),
      );
    });
  });

  describe('failure flow', () => {
    it('shows Retry button and error message when applyResourceChange throws', async () => {
      mockApplyResourceChange.mockRejectedValue(
        new Error('Release binding not found'),
      );
      renderButton();
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument(),
      );
      expect(screen.getByText(/Release binding not found/)).toBeInTheDocument();
    });

    it('does not call onApplied when applyResourceChange fails', async () => {
      mockApplyResourceChange.mockRejectedValue(new Error('oops'));
      const onApplied = jest.fn();
      renderButton(revisedAction, { onApplied });
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument(),
      );
      expect(onApplied).not.toHaveBeenCalled();
    });

    it('retries when the Retry button is clicked', async () => {
      mockApplyResourceChange
        .mockRejectedValueOnce(new Error('first failure'))
        .mockResolvedValueOnce(undefined);

      renderButton();
      fireEvent.click(
        screen.getByRole('button', { name: /apply recommendation/i }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /retry/i }),
        ).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /applied/i })).toBeDisabled(),
      );
      expect(mockApplyResourceChange).toHaveBeenCalledTimes(2);
    });
  });
});
