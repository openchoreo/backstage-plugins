import { useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Button,
  TextField,
  LinearProgress,
  Tooltip,
} from '@material-ui/core';
import BuildIcon from '@material-ui/icons/Build';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { useApi, fetchApiRef } from '@backstage/core-plugin-api';
import { useRcaUpdatePermission } from '@openchoreo/backstage-plugin-react';
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

type ActionStatus = 'idle' | 'applying' | 'success' | 'failed' | 'dismissed';

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

/** Check whether all actions in the set are resolved (applied or dismissed) */
export function allActionsResolved(
  actions: { action: RecommendedAction }[],
): boolean {
  return (
    actions.length > 0 &&
    actions.every(
      ({ action }) =>
        action.status === 'applied' || action.status === 'dismissed',
    )
  );
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
    if (
      current[key] === null ||
      current[key] === undefined ||
      typeof current[key] !== 'object'
    ) {
      current[key] = {};
    }
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
    doc.spec ??= {};
    doc.spec.workloadOverrides ??= {};
    doc.spec.workloadOverrides.container ??= {};
    doc.spec.workloadOverrides.container.env = env;
  }
}

function applyFileChange(
  doc: any,
  key: string,
  mountPath: string,
  value: string,
): void {
  const files: { key: string; value: string; mountPath: string }[] =
    doc.spec?.workloadOverrides?.container?.files ?? [];
  const existing = files.find(f => f.key === key && f.mountPath === mountPath);
  if (existing) {
    existing.value = value;
  } else {
    throw new Error(
      `File mount '${key}' at '${mountPath}' not found in binding`,
    );
  }
}

type PrimitiveValue = string | number | boolean;

interface EditableField {
  label: string;
  value: PrimitiveValue;
  fieldIdx: number;
}

interface FileField {
  fileKey: string;
  mountPath: string;
  content: { value: string; fieldIdx: number };
}

interface FieldNode {
  label: string | null; // null = leaf (render the field)
  field?: EditableField; // present only for leaves
  children?: FieldNode[];
}

interface PatchSection {
  title: string;
  envVars?: EditableField[];
  files?: FileField[];
  fieldTree?: FieldNode[];
}

function buildFieldTree(fields: EditableField[]): FieldNode[] {
  // Group by first segment of label
  const prefixMap = new Map<string, EditableField[]>();
  const leaves: FieldNode[] = [];

  for (const f of fields) {
    const dot = f.label.indexOf('.');
    if (dot > 0) {
      const prefix = f.label.slice(0, dot);
      const list = prefixMap.get(prefix) ?? [];
      list.push({ ...f, label: f.label.slice(dot + 1) });
      prefixMap.set(prefix, list);
    } else {
      leaves.push({ label: null, field: f });
    }
  }

  const nodes: FieldNode[] = [...leaves];

  for (const [prefix, children] of prefixMap) {
    if (children.length === 1) {
      // Only 1 child — don't nest, restore the full label
      nodes.push({
        label: null,
        field: { ...children[0], label: `${prefix}.${children[0].label}` },
      });
    } else {
      // 2+ children — recurse
      nodes.push({ label: prefix, children: buildFieldTree(children) });
    }
  }

  return nodes;
}

function extractPatchSections(rc: ResourceChange): PatchSection[] {
  const sections: PatchSection[] = [];
  let fieldIdx = 0;

  // Workload overrides: env vars and files
  const envVars: EditableField[] = [];
  const files: FileField[] = [];

  for (const e of (rc.env ?? []) as EnvVarChange[]) {
    envVars.push({ label: e.key, value: e.value, fieldIdx: fieldIdx++ });
  }
  for (const f of (rc.files ?? []) as FileChange[]) {
    files.push({
      fileKey: f.key,
      mountPath: f.mount_path,
      content: { value: f.value, fieldIdx: fieldIdx++ },
    });
  }

  if (envVars.length > 0 || files.length > 0) {
    sections.push({
      title: 'Workload Overrides',
      envVars: envVars.length > 0 ? envVars : undefined,
      files: files.length > 0 ? files : undefined,
    });
  }

  // Group field changes by section (componentType vs trait instances)
  const componentTypeFields: EditableField[] = [];
  const traitFieldsMap = new Map<string, EditableField[]>();

  for (const f of (rc.fields ?? []) as FieldChange[]) {
    const parts = f.json_pointer.replace(/^\/spec\//, '').split('/');
    const section = parts[0];
    const label = parts
      .slice(section === 'traitEnvironmentConfigs' ? 2 : 1)
      .join('.');

    if (section === 'traitEnvironmentConfigs' && parts.length >= 2) {
      const traitName = parts[1];
      const list = traitFieldsMap.get(traitName) ?? [];
      list.push({ label, value: f.value, fieldIdx: fieldIdx++ });
      traitFieldsMap.set(traitName, list);
    } else {
      componentTypeFields.push({
        label,
        value: f.value,
        fieldIdx: fieldIdx++,
      });
    }
  }

  if (componentTypeFields.length > 0) {
    sections.push({
      title: 'Component Overrides',
      fieldTree: buildFieldTree(componentTypeFields),
    });
  }

  for (const [traitName, traitFields] of traitFieldsMap) {
    sections.push({
      title: `Trait: ${traitName}`,
      fieldTree: buildFieldTree(traitFields),
    });
  }

  return sections;
}

const monoInputStyle = { fontFamily: 'monospace', fontSize: '0.8rem' } as const;

export const PatchTabContent = ({
  reportId,
  chatContext,
  revisedActions,
}: PatchTabContentProps) => {
  const classes = useRCAReportStyles();
  const fetchApi = useApi(fetchApiRef);
  const {
    canUpdateRca,
    loading: permissionLoading,
    deniedTooltip,
  } = useRcaUpdatePermission();

  const allResolved = allActionsResolved(revisedActions);

  const [phase, setPhase] = useState<Phase>(allResolved ? 'done' : 'idle');
  const [actionStates, setActionStates] = useState<Map<number, ActionState>>(
    () => {
      if (!allResolved) return new Map();
      const m = new Map<number, ActionState>();
      for (const { index, action } of revisedActions) {
        m.set(index, {
          status: action.status === 'dismissed' ? 'dismissed' : 'success',
        });
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
  ): string => {
    const key = `${actionIdx}-${rcIdx}-${fieldIdx}`;
    return editedValues.get(key) ?? String(original);
  };

  /** Return the edited value coerced back to the original primitive type, or the original if unedited. */
  const getPatchValue = (
    actionIdx: number,
    rcIdx: number,
    fieldIdx: number,
    original: PrimitiveValue,
  ): PrimitiveValue => {
    const key = `${actionIdx}-${rcIdx}-${fieldIdx}`;
    const edited = editedValues.get(key);
    if (edited === undefined) return original;
    if (typeof original === 'number') {
      const n = Number(edited);
      return Number.isNaN(n) ? edited : n;
    }
    if (typeof original === 'boolean') {
      return edited === 'true';
    }
    return edited;
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
          const resourceChange = action.change as ResourceChange;
          if (!resourceChange) continue;
          const name = resourceChange.release_binding;
          const patches = bindingPatches.get(name) ?? [];
          patches.push({ actionIndex, rcIdx: 0, resourceChange });
          bindingPatches.set(name, patches);
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

              // Apply file changes (key + mount_path identify the mount, only value is editable)
              for (const f of (resourceChange.files ?? []) as FileChange[]) {
                const editedValue = getEditedValue(
                  actionIndex,
                  rcIdx,
                  itemIdx++,
                  f.value,
                );
                applyFileChange(updated, f.key, f.mount_path, editedValue);
              }

              // Apply field changes (JSON Pointers for trait/componentType overrides)
              for (const f of (resourceChange.fields ?? []) as FieldChange[]) {
                const patchVal = getPatchValue(
                  actionIndex,
                  rcIdx,
                  itemIdx,
                  f.value,
                );
                applyJsonPointer(updated, f.json_pointer, patchVal);
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
            await chatContext.rcaAgentApi.updateActionStatuses(
              reportId,
              {
                namespaceName: chatContext.namespaceName,
                environmentName: chatContext.environmentName,
              },
              { appliedIndices: successIndices },
            );
          } catch {
            // Non-fatal: the fix was applied, state update failed
          }
        }

        setActionStates(resultStates);
        setPhase(successIndices.length > 0 ? 'done' : 'error');
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
    [chatContext, reportId, fetchApi, editedValues],
  );

  const handleApplySingle = useCallback(
    (index: number, action: RecommendedAction) => {
      applyFixes([{ index, action }]);
    },
    [applyFixes],
  );

  const handleDismiss = useCallback(
    async (index: number) => {
      setActionStates(prev => {
        const next = new Map(prev);
        next.set(index, { status: 'applying' });
        return next;
      });
      try {
        await chatContext.rcaAgentApi.updateActionStatuses(
          reportId,
          {
            namespaceName: chatContext.namespaceName,
            environmentName: chatContext.environmentName,
          },
          { dismissedIndices: [index] },
        );
        setActionStates(prev => {
          const next = new Map(prev);
          next.set(index, { status: 'dismissed' });
          return next;
        });
      } catch {
        setActionStates(prev => {
          const next = new Map(prev);
          next.set(index, { status: 'failed', details: 'Failed to dismiss' });
          return next;
        });
      }
    },
    [chatContext, reportId],
  );

  const renderActionButtons = (index: number, action: RecommendedAction) => {
    const localStatus = actionStates.get(index)?.status;

    if (localStatus === 'applying') {
      return (
        <Button variant="outlined" size="small" disabled>
          Applying...
        </Button>
      );
    }

    if (localStatus === 'success' || action.status === 'applied') {
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

    if (localStatus === 'dismissed' || action.status === 'dismissed') {
      return (
        <Button variant="outlined" size="small" disabled>
          Dismissed
        </Button>
      );
    }

    if (localStatus === 'failed') {
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

    const busy = phase === 'running';
    const disableActions = busy || permissionLoading || !canUpdateRca;
    return (
      <Box display="flex" style={{ gap: 8 }}>
        <Tooltip title={deniedTooltip}>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloseIcon />}
              onClick={() => handleDismiss(index)}
              disabled={disableActions}
            >
              Dismiss
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={deniedTooltip}>
          <span>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<BuildIcon />}
              onClick={() => handleApplySingle(index, action)}
              disabled={disableActions}
            >
              Apply Fix
            </Button>
          </span>
        </Tooltip>
      </Box>
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

  const isRunning = phase === 'running';

  const renderFieldNodes = (
    nodes: FieldNode[],
    actionIdx: number,
    disabled: boolean,
    depth = 0,
  ): React.ReactNode =>
    nodes.map((node, nIdx) => {
      if (node.field) {
        const f = node.field;
        return (
          <TextField
            key={`${actionIdx}-field-${f.fieldIdx}`}
            fullWidth
            variant="outlined"
            size="small"
            label={f.label}
            value={getEditedValue(actionIdx, 0, f.fieldIdx, f.value)}
            onChange={e =>
              setEditedValue(actionIdx, 0, f.fieldIdx, e.target.value)
            }
            disabled={disabled}
            InputProps={{ style: monoInputStyle }}
            InputLabelProps={{ shrink: true }}
          />
        );
      }
      return (
        <Box
          key={`${actionIdx}-grp-${depth}-${nIdx}`}
          display="flex"
          flexDirection="column"
          style={{ gap: 10 }}
        >
          <Typography variant="caption" color="textSecondary">
            {node.label}
          </Typography>
          {node.children &&
            renderFieldNodes(node.children, actionIdx, disabled, depth + 1)}
        </Box>
      );
    });

  return (
    <Box>
      {revisedActions.map(({ index, action }) => {
        const rc = action.change as ResourceChange | undefined;
        const sections = rc ? extractPatchSections(rc) : [];
        const state = actionStates.get(index)?.status;
        const disabled =
          isRunning ||
          action.status === 'applied' ||
          action.status === 'dismissed' ||
          state === 'success' ||
          state === 'dismissed';
        return (
          <Box key={index} className={classes.patchActionCard}>
            {rc && (
              <Typography className={classes.patchBindingName}>
                {rc.release_binding}
              </Typography>
            )}
            <Typography
              component="div"
              className={classes.patchActionDescription}
            >
              <FormattedText text={action.description} disableMarkdown />
            </Typography>

            {sections.length > 0 && (
              <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
                {sections.map((section, sIdx) => (
                  <Box
                    key={`${index}-s-${sIdx}`}
                    display="flex"
                    flexDirection="column"
                    style={{ gap: 10 }}
                  >
                    <Typography
                      variant="caption"
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                      color="textSecondary"
                    >
                      {section.title}
                    </Typography>

                    {section.envVars && (
                      <Box
                        display="flex"
                        flexDirection="column"
                        style={{ gap: 8 }}
                      >
                        <Typography
                          variant="caption"
                          style={{ fontSize: '0.6rem' }}
                          color="textSecondary"
                        >
                          Environment Variables
                        </Typography>
                        {section.envVars.map(ev => (
                          <TextField
                            key={`${index}-env-${ev.fieldIdx}`}
                            fullWidth
                            variant="outlined"
                            size="small"
                            label={ev.label}
                            value={getEditedValue(
                              index,
                              0,
                              ev.fieldIdx,
                              ev.value,
                            )}
                            onChange={e =>
                              setEditedValue(
                                index,
                                0,
                                ev.fieldIdx,
                                e.target.value,
                              )
                            }
                            disabled={disabled}
                            InputProps={{ style: monoInputStyle }}
                            InputLabelProps={{ shrink: true }}
                          />
                        ))}
                      </Box>
                    )}

                    {section.files && (
                      <Box
                        display="flex"
                        flexDirection="column"
                        style={{ gap: 8 }}
                      >
                        <Typography
                          variant="caption"
                          style={{ fontSize: '0.6rem' }}
                          color="textSecondary"
                        >
                          Files
                        </Typography>
                        {section.files.map(file => (
                          <TextField
                            key={`${index}-file-${file.content.fieldIdx}`}
                            fullWidth
                            variant="outlined"
                            size="small"
                            label={`${file.mountPath.replace(/\/?$/, '/')}${
                              file.fileKey
                            }`}
                            value={getEditedValue(
                              index,
                              0,
                              file.content.fieldIdx,
                              file.content.value,
                            )}
                            onChange={e =>
                              setEditedValue(
                                index,
                                0,
                                file.content.fieldIdx,
                                e.target.value,
                              )
                            }
                            disabled={disabled}
                            multiline
                            minRows={3}
                            maxRows={12}
                            InputProps={{ style: monoInputStyle }}
                            InputLabelProps={{
                              shrink: true,
                              style: {
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                            }}
                          />
                        ))}
                      </Box>
                    )}

                    {section.fieldTree &&
                      renderFieldNodes(section.fieldTree, index, disabled)}
                  </Box>
                ))}
              </Box>
            )}

            {actionStates.get(index)?.status === 'applying' && (
              <LinearProgress style={{ borderRadius: 2 }} />
            )}

            <Box className={classes.patchActionFooter}>
              <Box />
              {renderActionButtons(index, action)}
            </Box>
          </Box>
        );
      })}

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
