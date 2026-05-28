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
}

/**
 * Builds the trigger value: "All" / "None" / the single selected value /
 * "<first value> +N" for a multi-selection. `selectedOptions` must be in menu
 * order so the shown value is stable.
 */
function triggerValue(
  selectedOptions: MultiSelectOption[],
  total: number,
): string {
  if (total === 0 || selectedOptions.length === total) return 'All';
  if (selectedOptions.length === 0) return 'None';
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
}: MultiSelectFilterProps) => {
  const classes = useStyles();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const allSelected =
    allValues.length > 0 && selected.size === allValues.length;
  const noneSelected = selected.size === 0;
  const isFiltering = allValues.length > 0 && !allSelected;

  // Selected options in menu order, for a stable trigger label + tooltip.
  const orderedOptions = groups.flatMap(group => group.options);
  const selectedOptions = orderedOptions.filter(option =>
    selected.has(option.value),
  );
  const tooltipTitle =
    isFiltering && selectedOptions.length > 0
      ? selectedOptions.map(option => option.label).join(', ')
      : '';

  const toggle = (value: string) => {
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
        {/* span wrapper keeps the tooltip working even when the button is disabled */}
        <span>
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
            disabled={allValues.length === 0}
          >
            <span className={classes.buttonLabel}>
              {label}: {triggerValue(selectedOptions, allValues.length)}
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
          <Button
            color="primary"
            className={classes.menuActionButton}
            disabled={noneSelected}
            onClick={() => onChange(new Set())}
          >
            Clear
          </Button>
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
              className={classes.menuItem}
              onClick={() => toggle(option.value)}
            >
              <Checkbox
                edge="start"
                size="small"
                color="primary"
                className={classes.checkbox}
                checked={selected.has(option.value)}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-label': option.label }}
              />
              <Typography variant="body2" style={{ flexGrow: 1 }}>
                {option.label}
              </Typography>
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
