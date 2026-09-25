import { TextField, Typography, Box } from '@material-ui/core';
import type { ParameterRow } from './hookBindingValidation';

const SOURCE_LABEL: Record<ParameterRow['source'], string> = {
  fixed: 'fixed by the hook',
  from: 'computed from the release',
  'from-overridable': 'computed from the release · overridable',
  default: 'default',
  required: 'required',
};

interface HookParametersFieldProps {
  rows: ParameterRow[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** Flag missing required values; off until the user tries to submit. */
  showErrors?: boolean;
}

/**
 * One row per hook parameter. Only rows the webhook lets a binding set are
 * editable; fixed and non-overridable computed parameters are shown so the
 * engineer sees the full mapping, but their values are never emitted.
 */
export function HookParametersField({
  rows,
  values,
  onChange,
  showErrors = false,
}: HookParametersFieldProps) {
  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="textSecondary">
        This hook declares no parameters.
      </Typography>
    );
  }
  return (
    <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
      {rows.map(row => {
        const value = values[row.name] ?? '';
        const missing = showErrors && row.mandatory && !value;
        let helperText = SOURCE_LABEL[row.source];
        if (missing) {
          helperText = `${helperText} — the binding must supply a value`;
        } else if (row.source === 'from-overridable' && !value) {
          helperText = `${helperText}: ${row.hookValue}`;
        }
        return (
          <TextField
            key={row.name}
            label={row.name}
            value={row.editable ? value : row.hookValue ?? ''}
            onChange={e => onChange({ ...values, [row.name]: e.target.value })}
            disabled={!row.editable}
            required={row.mandatory}
            error={missing}
            variant="outlined"
            size="small"
            fullWidth
            inputProps={{ 'data-testid': `hook-param-${row.name}` }}
            helperText={helperText}
          />
        );
      })}
    </Box>
  );
}
