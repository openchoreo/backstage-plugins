import { useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Button,
  TextField,
  LinearProgress,
} from '@material-ui/core';
import BuildIcon from '@material-ui/icons/Build';
import CheckIcon from '@material-ui/icons/Check';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { useApi, fetchApiRef } from '@backstage/core-plugin-api';
import { useRCAReportStyles } from '../styles';
import { FormattedText } from '../FormattedText';
import type {
  RCAAgentApi,
  RecommendedAction,
  ResourceChange,
  EnvVarChange,
  FileChange,
  FieldChange,
} from '../../../../api/RCAAgentApi';

interface ChatContext {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  rcaAgentApi: RCAAgentApi;
  backendBaseUrl?: string;
}

type ActionStatus = 'idle' | 'applying' | 'success' | 'failed';

interface ActionState {
  status: ActionStatus;
  details?: string;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

interface PatchTabContentProps {
  reportId: string;
  chatContext: ChatContext;
  revisedActions: { index: number; action: RecommendedAction }[];
}

/** localStorage key for tracking applied state per report */
export function patchAppliedKey(reportId: string): string {
  return `rca-patch-applied:${reportId}`;
}

const ALLOWED_OVERRIDE_CATEGORIES = new Set([
  'workloadOverrides',
  'traitEnvironmentConfigs',
  'componentTypeEnvironmentConfigs',
]);

function applyJsonPointer(doc: any, pointer: string, value: any): void {
  const keys = pointer.replace(/^\//, '').split('/');
  if (
    keys.length < 3 ||
    keys[0] !== 'spec' ||
    !ALLOWED_OVERRIDE_CATEGORIES.has(keys[1])
  ) {
    throw new Error(`Invalid pointer: '${pointer}'`);
  }
  let current = doc;
  for (const key of keys.slice(0, -1)) {
    current = current[key];
  }
  const last = keys.at(-1)!;
  current[last] = value;
}

function applyEnvChange(doc: any, key: string, value: string): void {
  const env: { key: string; value: string }[] =
    doc.spec?.workloadOverrides?.container?.env ?? [];
  const existing = env.find(e => e.key === key);
  if (existing) {
    existing.value = value;
  } else {
    env.push({ key, value });
    // Ensure the path exists
    doc.spec ??= {};
    doc.spec.workloadOverrides ??= {};
    doc.spec.workloadOverrides.container ??= {};
    doc.spec.workloadOverrides.container.env = env;
  }
}

function applyFileChange(
  doc: any,
  key: string,
  value?: string,
  mountPath?: string,
): void {
  const files: { key: string; value?: string; mountPath?: string }[] =
    doc.spec?.workloadOverrides?.container?.files ?? [];
  const existing = files.find(f => f.key === key);
  if (existing) {
    if (value !== undefined) existing.value = value;
    if (mountPath !== undefined) existing.mountPath = mountPath;
  } else {
    const entry: { key: string; value?: string; mountPath?: string } = { key };
    if (value !== undefined) entry.value = value;
    if (mountPath !== undefined) entry.mountPath = mountPath;
    files.push(entry);
    doc.spec ??= {};
    doc.spec.workloadOverrides ??= {};
    doc.spec.workloadOverrides.container ??= {};
    doc.spec.workloadOverrides.container.files = files;
  }
}

/** A unified editable item extracted from env, files, or fields. */
interface PatchItem {
  type: 'env' | 'file' | 'field';
  label: string;
  value: string;
}

function extractPatchItems(rc: ResourceChange): PatchItem[] {
  const items: PatchItem[] = [];
  for (const e of (rc.env ?? []) as EnvVarChange[]) {
    items.push({ type: 'env', label: `env: ${e.key}`, value: e.value });
  }
  for (const f of (rc.files ?? []) as FileChange[]) {
    if (f.value !== undefined) {
      items.push({ type: 'file', label: `file: ${f.key}`, value: f.value });
    }
    if (f.mount_path !== undefined) {
      items.push({
        type: 'file',
        label: `file: ${f.key} (mountPath)`,
        value: f.mount_path,
      });
    }
  }
  for (const f of (rc.fields ?? []) as FieldChange[]) {
    items.push({
      type: 'field',
      label: f.json_pointer
        .replace(/^\/spec\/[^/]+\//, '')
        .split('/')
        .join('.'),
      value: String(f.value),
    });
  }
  return items;
}

export const PatchTabContent = ({
  reportId,
  chatContext,
  revisedActions,
}: PatchTabContentProps) => {
  const classes = useRCAReportStyles();
  const fetchApi = useApi(fetchApiRef);
  const storageKey = patchAppliedKey(reportId);

  const wasApplied = (() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  })();

  const [phase, setPhase] = useState<Phase>(wasApplied ? 'done' : 'idle');
  const [actionStates, setActionStates] = useState<Map<number, ActionState>>(
    () => {
      if (!wasApplied) return new Map();
      const m = new Map<number, ActionState>();
      for (const { index } of revisedActions) {
        m.set(index, { status: 'success' });
      }
      return m;
    },
  );
  const [error, setError] = useState('');

  // Editable values keyed by "actionIndex-resourceChangeIndex-fieldIndex"
  const [editedValues, setEditedValues] = useState<Map<string, string>>(
    new Map(),
  );

  const getEditedValue = (
    actionIdx: number,
    rcIdx: number,
    fieldIdx: number,
    original: string | number | boolean | Record<string, never> | unknown[],
  ) => {
    const key = `${actionIdx}-${rcIdx}-${fieldIdx}`;
    return editedValues.get(key) ?? String(original);
  };

  const setEditedValue = (
    actionIdx: number,
    rcIdx: number,
    fieldIdx: number,
    value: string,
  ) => {
    setEditedValues(prev => {
      const next = new Map(prev);
      next.set(`${actionIdx}-${rcIdx}-${fieldIdx}`, value);
      return next;
    });
  };

  const applyFixes = useCallback(
    async (actions: { index: number; action: RecommendedAction }[]) => {
      if (!chatContext.backendBaseUrl) {
        setError('Backend URL is not available');
        setPhase('error');
        return;
      }

      setPhase('running');
      setError('');

      const initial = new Map<number, ActionState>();
      for (const { index } of actions) {
        initial.set(index, { status: 'applying' });
      }
      setActionStates(initial);

      const successIndices: number[] = [];
      const resultStates = new Map<number, ActionState>();

      try {
        // Collect all resource changes grouped by binding name so we GET/PUT each binding once
        interface BindingPatch {
          actionIndex: number;
          rcIdx: number;
          resourceChange: ResourceChange;
        }
        const bindingPatches = new Map<string, BindingPatch[]>();
        for (const { index: actionIndex, action } of actions) {
          (action.changes as ResourceChange[]).forEach(
            (resourceChange, rcIdx) => {
              const name = resourceChange.release_binding;
              const patches = bindingPatches.get(name) ?? [];
              patches.push({ actionIndex, rcIdx, resourceChange });
              bindingPatches.set(name, patches);
            },
          );
        }

        // Apply patches per binding: GET once → apply all changes → PUT once
        const failedActions = new Set<number>();
        for (const [bindingName, patches] of bindingPatches) {
          const bindingUrl = `${
            chatContext.backendBaseUrl
          }/release-binding?namespaceName=${encodeURIComponent(
            chatContext.namespaceName,
          )}&bindingName=${encodeURIComponent(bindingName)}`;

          const getResponse = await fetchApi.fetch(bindingUrl);

          if (!getResponse.ok) {
            const detail =
              getResponse.status === 404
                ? `Release binding '${bindingName}' not found`
                : `Failed to get release binding: ${getResponse.statusText}`;
            for (const { actionIndex } of patches) {
              resultStates.set(actionIndex, {
                status: 'failed',
                details: detail,
              });
              failedActions.add(actionIndex);
            }
            continue;
          }

          const binding = await getResponse.json();
          const updated = structuredClone(binding);

          try {
            for (const { actionIndex, rcIdx, resourceChange } of patches) {
              let itemIdx = 0;

              // Apply env changes
              for (const e of (resourceChange.env ?? []) as EnvVarChange[]) {
                const editedVal = getEditedValue(
                  actionIndex,
                  rcIdx,
                  itemIdx,
                  e.value,
                );
                applyEnvChange(updated, e.key, editedVal);
                itemIdx++;
              }

              // Apply file changes
              for (const f of (resourceChange.files ?? []) as FileChange[]) {
                const editedValue =
                  f.value !== undefined
                    ? getEditedValue(actionIndex, rcIdx, itemIdx++, f.value)
                    : undefined;
                const editedMount =
                  f.mount_path !== undefined
                    ? getEditedValue(
                        actionIndex,
                        rcIdx,
                        itemIdx++,
                        f.mount_path,
                      )
                    : undefined;
                applyFileChange(updated, f.key, editedValue, editedMount);
              }

              // Apply field changes (JSON Pointers for trait/componentType overrides)
              for (const f of (resourceChange.fields ?? []) as FieldChange[]) {
                const editedVal = getEditedValue(
                  actionIndex,
                  rcIdx,
                  itemIdx,
                  f.value,
                );
                applyJsonPointer(updated, f.json_pointer, editedVal);
                itemIdx++;
              }
            }
          } catch (err) {
            for (const { actionIndex } of patches) {
              resultStates.set(actionIndex, {
                status: 'failed',
                details:
                  err instanceof Error
                    ? err.message
                    : 'Failed to apply changes',
              });
              failedActions.add(actionIndex);
            }
            continue;
          }

          const putResponse = await fetchApi.fetch(bindingUrl, {
            method: 'PUT',
            body: JSON.stringify({
              metadata: updated.metadata,
              spec: updated.spec,
            }),
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (!putResponse.ok) {
            for (const { actionIndex } of patches) {
              resultStates.set(actionIndex, {
                status: 'failed',
                details: `Failed to update release binding: ${putResponse.statusText}`,
              });
              failedActions.add(actionIndex);
            }
          }
        }

        // Mark actions that had no failures as successful
        for (const { index } of actions) {
          if (!failedActions.has(index)) {
            successIndices.push(index);
            resultStates.set(index, {
              status: 'success',
              details: 'Applied successfully',
            });
          }
        }

        // Mark applied actions in the RCA agent backend
        if (successIndices.length > 0) {
          try {
            await chatContext.rcaAgentApi.markActionsApplied(
              reportId,
              {
                namespaceName: chatContext.namespaceName,
                environmentName: chatContext.environmentName,
              },
              successIndices,
            );
          } catch {
            // Non-fatal: the fix was applied, state update failed
          }
        }

        setActionStates(resultStates);
        setPhase(successIndices.length > 0 ? 'done' : 'error');

        if (
          successIndices.length > 0 &&
          successIndices.length === actions.length
        ) {
          try {
            localStorage.setItem(storageKey, 'true');
          } catch {
            // ignore
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to apply fixes';
        const failed = new Map<number, ActionState>();
        for (const { index } of actions) {
          failed.set(index, { status: 'failed', details: msg });
        }
        setActionStates(failed);
        setError(msg);
        setPhase('error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatContext, reportId, fetchApi, storageKey, editedValues],
  );

  const handleApplySingle = useCallback(
    (index: number, action: RecommendedAction) => {
      applyFixes([{ index, action }]);
    },
    [applyFixes],
  );

  const renderActionButton = (index: number, action: RecommendedAction) => {
    const state = actionStates.get(index);

    if (state?.status === 'applying') {
      return (
        <Button variant="outlined" size="small" disabled>
          Applying...
        </Button>
      );
    }

    if (state?.status === 'success') {
      return (
        <Button
          variant="outlined"
          size="small"
          disabled
          startIcon={<CheckIcon style={{ color: '#4caf50' }} />}
        >
          Applied
        </Button>
      );
    }

    if (state?.status === 'failed') {
      return (
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={<ErrorOutlineIcon />}
          disabled
        >
          Failed
        </Button>
      );
    }

    return (
      <Button
        variant="outlined"
        color="primary"
        size="small"
        startIcon={<BuildIcon />}
        onClick={() => handleApplySingle(index, action)}
        disabled={phase !== 'idle'}
      >
        Apply Fix
      </Button>
    );
  };

  if (revisedActions.length === 0) {
    return (
      <Box padding={2} textAlign="center">
        <Typography variant="body2" color="textSecondary">
          No revised actions available. The remediation agent has not yet
          proposed any concrete fixes for this report.
        </Typography>
      </Box>
    );
  }

  const isRunning =
    phase === 'running' || phase === 'done' || phase === 'error';

  return (
    <Box>
      {revisedActions.map(({ index, action }) => (
        <Box key={index} className={classes.patchActionCard}>
          <Typography
            component="div"
            className={classes.patchActionDescription}
          >
            <FormattedText text={action.description} />
          </Typography>

          {(action.changes as ResourceChange[]).map((resourceChange, rcIdx) =>
            extractPatchItems(resourceChange).map((item, itemIdx) => (
              <TextField
                key={`${index}-${rcIdx}-${itemIdx}`}
                fullWidth
                variant="outlined"
                size="small"
                label={item.label}
                value={getEditedValue(index, rcIdx, itemIdx, item.value)}
                onChange={e =>
                  setEditedValue(index, rcIdx, itemIdx, e.target.value)
                }
                disabled={isRunning}
                InputProps={{
                  style: { fontFamily: 'monospace', fontSize: '0.8rem' },
                }}
                InputLabelProps={{ shrink: true }}
              />
            )),
          )}

          {actionStates.get(index)?.status === 'applying' && (
            <LinearProgress style={{ borderRadius: 2 }} />
          )}

          <Box className={classes.patchActionFooter}>
            <Box />
            {renderActionButton(index, action)}
          </Box>
        </Box>
      ))}

      {phase === 'error' && (
        <Box display="flex" alignItems="center" mt={1} p={1} style={{ gap: 8 }}>
          <ErrorOutlineIcon color="error" fontSize="small" />
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
