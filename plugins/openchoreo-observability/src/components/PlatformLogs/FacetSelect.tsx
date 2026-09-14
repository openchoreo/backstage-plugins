import { FC, useEffect, useRef } from 'react';
import {
  Checkbox,
  CircularProgress,
  TextField,
  Typography,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import { useFacetSelectStyles } from './styles';

interface FacetSelectProps {
  label: string;
  /**
   * The values on offer, in the order they should be shown - by record count when the
   * observer answered, alphabetical when they were derived from the loaded rows.
   */
  options: string[];
  /**
   * Records carrying each value, when that is known. Kept beside `options` rather than
   * folded into them so every value MUI handles stays a plain string: under `freeSolo`
   * a typed entry arrives as a string, and object options would make the selection a
   * mix of the two.
   */
  counts?: Record<string, number>;
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Whether the list is open. Owned by the parent, so only one picker opens at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reports what has been typed, for narrowing the values server-side. */
  onSearchChange?: (text: string) => void;
  loading?: boolean;
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
 * A multi-select for one of the coordinate filters, offering the values on hand while
 * still accepting anything typed.
 *
 * `freeSolo` is not a nicety here. Even when the observer answers, the list is bounded
 * by the time window and capped at the values carrying the most records, and when it
 * cannot answer the list is whatever the loaded rows happened to mention. A pod that
 * has not logged lately is missing either way, so without free text the picker would be
 * strictly less capable than the plain text box it replaced.
 */
export const FacetSelect: FC<FacetSelectProps> = ({
  label,
  options,
  counts,
  selected,
  onChange,
  open,
  onOpenChange,
  onSearchChange,
  loading = false,
}) => {
  const classes = useFacetSelectStyles();
  const summary = summarise(selected);

  // The dropdown is controlled so it can be closed explicitly. MUI's Autocomplete has
  // no click-away handling of its own: it closes only from the input's `onBlur`, so a
  // click that never blurs the input leaves the popup orphaned and open.
  //
  // The state lives with the parent, which is what keeps a second picker from opening
  // over the first and makes "which one is open" a thing the row can act on. The
  // outside-click handling stays here, because it needs this component's DOM node.
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
      onOpenChange(false);
    };

    document.addEventListener('mousedown', closeOnOutsideMouseDown);
    return () =>
      document.removeEventListener('mousedown', closeOnOutsideMouseDown);
  }, [open, onOpenChange]);

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
        onOpen={() => onOpenChange(true)}
        onClose={() => onOpenChange(false)}
        loading={loading}
        options={options}
        // Reported only while someone is typing. Selecting an option also fires this,
        // with reason 'reset' as MUI clears the input, and taking that for a search
        // would leave the next open narrowed by text nobody can see.
        onInputChange={(_, value, reason) =>
          onSearchChange?.(reason === 'input' ? value : '')
        }
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
            {counts?.[option] !== undefined && (
              <Typography variant="caption" className={classes.optionCount}>
                {counts[option].toLocaleString()}
              </Typography>
            )}
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
              // Composed before MUI's own adornment rather than replacing it: that one
              // holds the dropdown arrow.
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </div>
  );
};
