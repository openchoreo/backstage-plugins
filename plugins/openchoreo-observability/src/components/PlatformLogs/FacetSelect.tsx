import { FC, useEffect, useRef, useState } from 'react';
import { Checkbox, TextField, Typography } from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import { useFacetSelectStyles } from './styles';

interface FacetSelectProps {
  label: string;
  /** Values seen in the logs loaded so far. May be empty before the first result. */
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

/**
 * Summarises the selection rather than listing it: "All" when nothing is picked, the
 * value itself when one is, "N selected" beyond that.
 *
 * Rendering each selection as a chip inside the field made the control grow as it was
 * used, so four of them side by side never kept a common height. What is applied is
 * already summarised by the chips in the toolbar; this field only needs to say how much.
 */
function summarise(selected: string[]): string {
  if (selected.length === 0) return 'All';
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
}

/**
 * A multi-select for one of the coordinate filters, offering the values seen so far
 * while still accepting anything typed.
 *
 * `freeSolo` is not a nicety here. The options come from loaded results rather than a
 * facet endpoint, so the list is necessarily incomplete - a pod that has not logged in
 * the current window is missing from it. Without free text the picker would be strictly
 * less capable than the plain text box it replaced.
 */
export const FacetSelect: FC<FacetSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  disabled = false,
}) => {
  const classes = useFacetSelectStyles();
  const summary = summarise(selected);

  // The dropdown is controlled so it can be closed explicitly. MUI's Autocomplete has
  // no click-away handling of its own: it closes only from the input's `onBlur`, so a
  // click that never blurs the input leaves the popup orphaned and open.
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      // `disablePortal` keeps the listbox inside this element, so one containment check
      // covers both the field and the options. Matching the popper by class instead
      // would be silently wrong: under a nested ThemeProvider - which Backstage uses -
      // MUI appends a counter, so the class is `MuiAutocomplete-popper-42` and a
      // `.MuiAutocomplete-popper` selector never matches. Picking an option would then
      // read as a click away and close the list before the click could select.
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideMouseDown);
    return () =>
      document.removeEventListener('mousedown', closeOnOutsideMouseDown);
  }, [open]);

  return (
    <div ref={rootRef}>
      <Autocomplete
        multiple
        freeSolo
        disableCloseOnSelect
        // Keeps the listbox inside the root, which makes the containment check above
        // exact and lets the Autocomplete's own "keep focus in the input" mousedown
        // guard cover the options too. The filter row's Collapse is `overflow: visible`
        // once expanded, so the list is not clipped.
        disablePortal
        size="small"
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        disabled={disabled}
        options={options}
        value={selected}
        // Autocomplete hands back (string | string[]) under freeSolo; the multiple form
        // is always an array of the entered/selected strings.
        onChange={(_, value) =>
          onChange((value as string[]).map(v => v.trim()).filter(Boolean))
        }
        // The selection is summarised in the field instead, so the control keeps one
        // height however much is picked.
        renderTags={() => null}
        renderOption={(option, { selected: isSelected }) => (
          <span className={classes.option}>
            {/* Not a tab stop: the option row is what is interactive, not the box. */}
            <Checkbox
              size="small"
              checked={isSelected}
              tabIndex={-1}
              disableRipple
            />
            <span className={classes.optionLabel}>{option}</span>
          </span>
        )}
        renderInput={params => (
          <TextField
            {...params}
            label={label}
            variant="outlined"
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Typography
                  variant="body2"
                  className={
                    selected.length > 0 ? classes.summary : classes.summaryEmpty
                  }
                >
                  {summary}
                </Typography>
              ),
            }}
          />
        )}
      />
    </div>
  );
};
