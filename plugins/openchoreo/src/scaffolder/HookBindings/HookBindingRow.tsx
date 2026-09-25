import { useMemo } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Grid,
  IconButton,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import type {
  HookFailurePolicy,
  HookMode,
  HookSubjectSelector,
} from '@openchoreo/backstage-plugin-common';
import { HookParametersField } from './HookParametersField';
import {
  FAILURE_POLICIES_BY_PHASE,
  HOOK_MODES,
  MAX_RETRIES,
  allowedSubjectTypes,
  deriveBindingName,
  hookOptionKey,
  initialParameters,
  parameterRowsForHook,
  selectorsOutsideEnabledTo,
  type HookBindingFormData,
  type HookOption,
  type HookPhase,
  type SubjectTypeOption,
} from './hookBindingValidation';
import { useStyles } from './styles';

interface HookBindingRowProps {
  binding: HookBindingFormData;
  phase: HookPhase;
  hooks: HookOption[];
  subjectTypes: SubjectTypeOption[];
  errors: string[];
  /** Show validation errors; off until the user tries to submit. */
  showErrors?: boolean;
  onChange: (binding: HookBindingFormData) => void;
  onRemove: () => void;
}

const selectorKey = (s: { kind: string; name: string }) =>
  `${s.kind}/${s.name}`;

export function HookBindingRow({
  binding,
  phase,
  hooks,
  subjectTypes,
  errors,
  showErrors = false,
  onChange,
  onRemove,
}: HookBindingRowProps) {
  const classes = useStyles();

  const hook = useMemo(
    () =>
      hooks.find(
        h =>
          h.kind === (binding.hookRef.kind ?? 'Hook') &&
          h.name === binding.hookRef.name,
      ),
    [hooks, binding.hookRef],
  );
  const parameterRows = useMemo(
    () => (hook ? parameterRowsForHook(hook.parameters) : []),
    [hook],
  );
  const typeOptions = useMemo(
    () => allowedSubjectTypes(subjectTypes, hook?.enabledTo ?? []),
    [subjectTypes, hook],
  );
  const outside = useMemo(
    () => selectorsOutsideEnabledTo(binding.appliesTo, hook?.enabledTo ?? []),
    [binding.appliesTo, hook],
  );

  const selectHook = (key: string) => {
    const next = hooks.find(h => hookOptionKey(h) === key);
    if (!next) return;
    const previousAuto =
      !binding.name || binding.name === deriveBindingName(binding.hookRef.name);
    onChange({
      ...binding,
      hookRef: { kind: next.kind, name: next.name },
      name: previousAuto ? deriveBindingName(next.name) : binding.name,
      parameters: initialParameters(next.parameters),
      // Selectors the new hook is not enabled for would only ever be Skipped.
      appliesTo: binding.appliesTo.filter(
        s => !selectorsOutsideEnabledTo([s], next.enabledTo).length,
      ),
    });
  };

  const setMode = (mode: HookMode) => {
    if (mode === 'Async') {
      // The webhook rejects onFailure/timeout/retries on Async bindings.
      const { onFailure, timeout, retries, ...rest } = binding;
      onChange({ ...rest, mode });
    } else {
      onChange({
        ...binding,
        mode,
        onFailure: FAILURE_POLICIES_BY_PHASE[phase][0],
        timeout: '30m',
        retries: 0,
      });
    }
  };

  const setAppliesTo = (keys: string[]) => {
    const selectors: HookSubjectSelector[] = keys
      .map(k => typeOptions.find(o => selectorKey(o) === k))
      .filter((o): o is SubjectTypeOption => !!o)
      .map(o => ({ kind: o.kind, name: o.name }));
    onChange({ ...binding, appliesTo: selectors });
  };

  const isSync = binding.mode === 'Sync';

  return (
    <div
      className={classes.hookBindingCard}
      data-testid={`hook-binding-${phase}-${binding.name || 'new'}`}
    >
      <div className={classes.promotionPathHeader}>
        <Typography variant="subtitle2">
          {binding.name || 'New hook binding'}
        </Typography>
        <IconButton
          size="small"
          className={classes.removeButton}
          onClick={onRemove}
          aria-label="Remove hook binding"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </div>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            select
            label="Hook"
            value={hook ? hookOptionKey(hook) : ''}
            onChange={e => selectHook(e.target.value)}
            fullWidth
            variant="outlined"
            size="small"
            required
            helperText={
              hook && hook.enabledTo.length > 0
                ? 'Enabled for the component types shown below'
                : 'Hook or ClusterHook to run'
            }
            SelectProps={{ 'data-testid': 'hook-select' } as never}
          >
            {hooks.length === 0 && (
              <MenuItem disabled value="">
                No hooks in this namespace
              </MenuItem>
            )}
            {hooks.map(h => (
              <MenuItem key={hookOptionKey(h)} value={hookOptionKey(h)}>
                {h.kind === 'ClusterHook' ? `${h.name} (cluster)` : h.name}
              </MenuItem>
            ))}
          </TextField>
          {hook && hook.enabledTo.length > 0 && (
            <Box mt={0.5} display="flex" flexWrap="wrap" style={{ gap: 4 }}>
              {hook.enabledTo.map(e => (
                <Chip
                  key={selectorKey(e)}
                  size="small"
                  variant="outlined"
                  label={`${e.kind}/${e.name}`}
                />
              ))}
            </Box>
          )}
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Binding name"
            value={binding.name}
            onChange={e => onChange({ ...binding, name: e.target.value })}
            fullWidth
            variant="outlined"
            size="small"
            required
            inputProps={{ 'data-testid': 'hook-binding-name' }}
            helperText="Unique across pre-deploy and post-deploy hooks of this environment"
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            select
            label="Mode"
            value={binding.mode}
            onChange={e => setMode(e.target.value as HookMode)}
            fullWidth
            variant="outlined"
            size="small"
            helperText={
              isSync
                ? 'The deployment waits for the hook'
                : 'Dispatched and never awaited'
            }
            SelectProps={{ 'data-testid': 'hook-mode-select' } as never}
          >
            {HOOK_MODES.map(m => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        {isSync && (
          <>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="On failure"
                value={binding.onFailure ?? FAILURE_POLICIES_BY_PHASE[phase][0]}
                onChange={e =>
                  onChange({
                    ...binding,
                    onFailure: e.target.value as HookFailurePolicy,
                  })
                }
                fullWidth
                variant="outlined"
                size="small"
                SelectProps={
                  { 'data-testid': 'hook-onfailure-select' } as never
                }
              >
                {FAILURE_POLICIES_BY_PHASE[phase].map(p => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label="Timeout"
                value={binding.timeout ?? ''}
                onChange={e =>
                  onChange({ ...binding, timeout: e.target.value })
                }
                fullWidth
                variant="outlined"
                size="small"
                inputProps={{ 'data-testid': 'hook-timeout' }}
                helperText="e.g. 30m"
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label="Retries"
                type="number"
                value={binding.retries ?? 0}
                onChange={e =>
                  onChange({ ...binding, retries: Number(e.target.value) })
                }
                fullWidth
                variant="outlined"
                size="small"
                inputProps={{
                  min: 0,
                  max: MAX_RETRIES,
                  'data-testid': 'hook-retries',
                }}
              />
            </Grid>
          </>
        )}

        <Grid item xs={12} sm={6}>
          <TextField
            select
            label="Applies to"
            value={binding.appliesTo.map(selectorKey)}
            onChange={e => setAppliesTo(e.target.value as unknown as string[])}
            fullWidth
            variant="outlined"
            size="small"
            error={showErrors && outside.length > 0}
            helperText={
              showErrors && outside.length > 0
                ? `Not enabled by the hook: ${outside
                    .map(selectorKey)
                    .join(', ')}`
                : 'Empty applies to every component'
            }
            SelectProps={
              {
                multiple: true,
                'data-testid': 'hook-appliesto-select',
                renderValue: (selected: unknown) =>
                  (selected as string[]).join(', '),
              } as never
            }
          >
            {typeOptions.length === 0 && (
              <MenuItem disabled value="">
                No component types available
              </MenuItem>
            )}
            {typeOptions.map(o => (
              <MenuItem key={selectorKey(o)} value={selectorKey(o)} dense>
                <Checkbox
                  size="small"
                  color="primary"
                  checked={binding.appliesTo.some(
                    a => selectorKey(a) === selectorKey(o),
                  )}
                  tabIndex={-1}
                  disableRipple
                />
                <ListItemText primary={selectorKey(o)} />
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary">
            Parameters
          </Typography>
          <HookParametersField
            rows={parameterRows}
            values={binding.parameters}
            onChange={parameters => onChange({ ...binding, parameters })}
            showErrors={showErrors}
          />
        </Grid>
      </Grid>

      {showErrors && errors.length > 0 && (
        <div className={classes.errorText} data-testid="hook-binding-errors">
          {errors.join('. ')}
        </div>
      )}
    </div>
  );
}
