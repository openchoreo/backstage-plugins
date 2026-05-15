import { useState, useCallback } from 'react';
import { Button, Box, LinearProgress, Tooltip } from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { Alert } from '@material-ui/lab';
import { useApi, fetchApiRef } from '@backstage/core-plugin-api';
import { useFinopsUpdatePermission } from '@openchoreo/backstage-plugin-react';
import type { FinOpsAgentApi } from '../../api/FinOpsAgentApi';
import type { FinOpsRemediationAction } from '../../types';
import { applyResourceChange } from '../../utils/applyResourceChange';

interface FinOpsApplyChatContext {
  backendBaseUrl?: string;
  namespaceName: string;
  environmentName: string;
  finopsAgentApi: FinOpsAgentApi;
}

interface FinOpsApplyButtonProps {
  reportId: string;
  actionIndex: number;
  action: FinOpsRemediationAction;
  chatContext: FinOpsApplyChatContext;
  onApplied?: () => void;
}

type ApplyStatus = 'idle' | 'applying' | 'success' | 'failed';

export const FinOpsApplyButton = ({
  reportId,
  actionIndex,
  action,
  chatContext,
  onApplied,
}: FinOpsApplyButtonProps) => {
  const fetchApi = useApi(fetchApiRef);
  const {
    canUpdateFinops,
    loading: permissionLoading,
    deniedTooltip,
  } = useFinopsUpdatePermission();

  const initialStatus: ApplyStatus =
    action.status === 'applied' ? 'success' : 'idle';
  const [status, setStatus] = useState<ApplyStatus>(initialStatus);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApply = useCallback(async () => {
    if (!chatContext.backendBaseUrl || !action.change) return;

    setStatus('applying');
    setErrorMsg('');

    try {
      await applyResourceChange({
        backendBaseUrl: chatContext.backendBaseUrl,
        fetchApi,
        namespaceName: chatContext.namespaceName,
        change: action.change,
      });

      try {
        await chatContext.finopsAgentApi.updateActionStatuses(
          reportId,
          {
            namespaceName: chatContext.namespaceName,
            environmentName: chatContext.environmentName,
          },
          { appliedIndices: [actionIndex] },
        );
      } catch {
        // Non-fatal: the binding was patched; status recording failed
      }

      setStatus('success');
      onApplied?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to apply recommendation',
      );
      setStatus('failed');
    }
  }, [chatContext, fetchApi, reportId, actionIndex, action.change, onApplied]);

  if (action.status === 'applied' || status === 'success') {
    return (
      <Button
        variant="outlined"
        size="small"
        disabled
        startIcon={<CheckIcon />}
      >
        Applied
      </Button>
    );
  }

  if (action.status === 'dismissed') {
    return (
      <Button variant="outlined" size="small" disabled>
        Dismissed
      </Button>
    );
  }

  if (status === 'applying') {
    return (
      <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
        <Button variant="outlined" size="small" disabled>
          Applying...
        </Button>
        <LinearProgress style={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (status === 'failed') {
    return (
      <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={<ErrorOutlineIcon />}
          onClick={handleApply}
        >
          Retry
        </Button>
        <Alert severity="error" style={{ fontSize: '0.8rem' }}>
          {errorMsg}
        </Alert>
      </Box>
    );
  }

  const missingConfig = !chatContext.backendBaseUrl || !action.change;
  const disabled = permissionLoading || !canUpdateFinops || missingConfig;
  const tooltipTitle = missingConfig
    ? 'Apply is unavailable: required configuration is missing'
    : deniedTooltip;

  return (
    <Tooltip title={tooltipTitle}>
      <span>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleApply}
          disabled={disabled}
        >
          Apply Recommendation
        </Button>
      </span>
    </Tooltip>
  );
};
