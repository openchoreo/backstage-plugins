import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useStyles } from './styles';

/** A single selectable option in a {@link MultiSelectFilter}. */
export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional count shown right-aligned in the menu item. */
  count?: number;
  /**
   * Fixed: shown, checked, and not toggleable — for a value the view cannot
   * function without. Clear and Select all leave it alone.
   */
  disabled?: boolean;
}

/** A group of options. Provide a `label` to render a heading; omit for a flat list. */
export interface MultiSelectGroup {
  label?: string;
  options: MultiSelectOption[];
}

export interface MultiSelectFilterProps {
  /** Trigger prefix, e.g. "Kind" or "Type". */
  label: string;
  groups: MultiSelectGroup[];
  /** Every selectable value across all groups (used for All/None state). */
  allValues: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  emptyLabel?: string;
  /**
   * Summarise the selection on the trigger. Turn it off where the menu is the
   * only place the selection matters, so the trigger keeps a stable width.
   */
  showSelection?: boolean;
  disabled?: boolean;
  /** Per-row "Only" action: Lets the user select a single item from a list with multiple selected. */
  showOnlyAction?: boolean;
  /** Show a lone option's name on the trigger instead of "All". */
  nameSoleOption?: boolean;
  hideClear?: boolean;
  disabledHint?: string;
}

/**
 * Builds the trigger value: "All" / the empty label / the single selected value
 * / "<first value> +N" for a multi-selection. `selectedOptions` must be in menu
 * order so the shown value is stable.
 */
function triggerValue(
  selectedOptions: MultiSelectOption[],
  total: number,
  emptyLabel: string,
  nameSoleOption: boolean,
): string {
  // When a list has only one item, the trigger shows that item rather than "All"
  if (nameSoleOption && total === 1 && selectedOptions.length === 1)
    return selectedOptions[0].label;
  if (total === 0 || selectedOptions.length === total) return 'All';
  if (selectedOptions.length === 0) return emptyLabel;
  const [first, ...rest] = selectedOptions;
  return rest.length === 0 ? first.label : `${first.label} +${rest.length}`;
}

/**
 * A multi-select dropdown filter: an outlined "{label}: All/None/<value>/<value> +N"
 * trigger opening a checkbox menu with Select all / Clear. Groups with a `label`
 * render a heading; a single group without a label renders a flat list. The full
 * selection is shown in a tooltip on hover.
 */
export const MultiSelectFilter = ({
  label,
  groups,
  allValues,
  selected,
  onChange,
  emptyLabel = 'None',
  showSelection = true,
  disabled = false,
  hideClear = false,
  showOnlyAction = false,
  nameSoleOption = false,
  disabledHint,
}: MultiSelectFilterProps) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const allSelected =
    allValues.length > 0 && selected.size === allValues.length;
  const isFiltering = allValues.length > 0 && !allSelected;

  // Selected options in menu order, for a stable trigger label + tooltip.
  const orderedOptions = groups.flatMap(group => group.options);
  const selectedOptions = orderedOptions.filter(option =>
    selected.has(option.value),
  );
  let tooltipTitle = '';
  if (disabled && disabledHint) tooltipTitle = disabledHint;
  else if (isFiltering && selectedOptions.length > 0) {
    tooltipTitle = selectedOptions.map(option => option.label).join(', ');
  }

  // Values the caller has fixed: they survive Clear, because a view that needs
  // them would otherwise be left unusable by one click.
  const fixedValues = orderedOptions
    .filter(option => option.disabled)
    .map(option => option.value);

  const toggle = (value: string) => {
    // Guarded here rather than only on the menu item: MUI disables that with
    // `pointer-events`, which is styling, not a rule.
    if (fixedValues.includes(value)) return;
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  };

  return (
    <>
      <Tooltip title={tooltipTitle}>
        {/* span wrapper keeps the tooltip working even when the button is
            disabled, and takes the focus the disabled button cannot, so a hint
            is reachable without a pointer. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <span tabIndex={disabled && disabledHint ? 0 : undefined}>
          <Button
            variant="outlined"
            size="small"
            className={
              open || isFiltering
                ? `${classes.button} ${classes.buttonActive}`
                : classes.button
            }
            endIcon={<ArrowDropDownIcon />}
            onClick={event => setAnchorEl(event.currentTarget)}
            aria-label={`Filter by ${label.toLowerCase()}`}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled || allValues.length === 0}
          >
            <span className={classes.buttonLabel}>
              {showSelection
                ? `${label}: ${triggerValue(
                    selectedOptions,
                    allValues.length,
                    emptyLabel,
                    nameSoleOption,
                  )}`
                : label}
            </span>
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        classes={{ paper: classes.menuPaper }}
        variant="menu"
      >
        <Box className={classes.menuActions}>
          <Button
            color="primary"
            className={classes.menuActionButton}
            disabled={allSelected}
            onClick={() => onChange(new Set(allValues))}
          >
            Select all
          </Button>
          {!hideClear && (
            <Button
              color="primary"
              className={classes.menuActionButton}
              disabled={[...selected].every(value =>
                fixedValues.includes(value),
              )}
              onClick={() => onChange(new Set(fixedValues))}
            >
              Clear
            </Button>
          )}
        </Box>
        {groups.flatMap((group, groupIndex) => [
          ...(group.label
            ? [
                <ListSubheader
                  key={`group-${groupIndex}-label`}
                  disableSticky
                  className={classes.groupLabel}
                >
                  {group.label}
                </ListSubheader>,
              ]
            : []),
          ...group.options.map(option => (
            <MenuItem
              key={`group-${groupIndex}-${option.value}`}
              dense
              disabled={option.disabled}
              className={classes.menuItem}
              onClick={() => toggle(option.value)}
            >
              <Checkbox
                edge="start"
                size="small"
                color="primary"
                className={classes.checkbox}
                checked={selected.has(option.value)}
                disabled={option.disabled}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-label': option.label }}
              />
              <Typography variant="body2" style={{ flexGrow: 1 }}>
                {option.label}
              </Typography>
              {showOnlyAction && !option.disabled && (
                <Button
                  color="primary"
                  className={classes.onlyAction}
                  aria-label={`Only ${option.label}`}
                  onClick={event => {
                    event.stopPropagation();
                    onChange(new Set([option.value]));
                  }}
                >
                  Only
                </Button>
              )}
              {option.count !== undefined && (
                <Typography variant="body2" color="textSecondary">
                  {option.count}
                </Typography>
              )}
            </MenuItem>
          )),
        ])}
      </Menu>
    </>
  );
};

MultiSelectFilter.displayName = 'MultiSelectFilter';
