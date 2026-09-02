import { FC } from 'react';
import { Chip, TextField } from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';

interface FacetSelectProps {
  label: string;
  /** Values seen in the logs loaded so far. May be empty before the first result. */
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

/**
 * A multi-select for one of the coordinate filters, offering the values seen so far
 * while still accepting anything typed.
 *
 * `freeSolo` is not a nicety here. The options come from loaded results rather than a
 * facet endpoint, so the list is necessarily incomplete - a pod that has not logged in
 * the current window is missing from it. Without free text the picker would be strictly
 * less capable than the plain text box it replaced.
 *
 * An empty selection means "All": no filter is sent.
 */
export const FacetSelect: FC<FacetSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  disabled = false,
}) => (
  <Autocomplete
    multiple
    freeSolo
    size="small"
    disabled={disabled}
    options={options}
    value={selected}
    // Autocomplete hands back (string | string[]) under freeSolo; the multiple form is
    // always an array of the entered/selected strings.
    onChange={(_, value) =>
      onChange((value as string[]).map(v => v.trim()).filter(Boolean))
    }
    renderTags={(value, getTagProps) =>
      value.map((option, index) => (
        <Chip size="small" label={option} {...getTagProps({ index })} />
      ))
    }
    renderInput={params => (
      <TextField
        {...params}
        label={label}
        variant="outlined"
        placeholder={selected.length === 0 ? 'All' : ''}
      />
    )}
  />
);
