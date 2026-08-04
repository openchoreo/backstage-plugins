import { FC, useRef, useState } from 'react';
import {
  Checkbox,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  TextField,
  makeStyles,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { Skeleton } from '@openchoreo/backstage-design-system';
import type { Environment } from '@openchoreo/backstage-plugin-react';

export interface EnvironmentMultiSelectProps {
  environments: Environment[];
  /** Selected environment names. */
  value: string[];
  onChange: (names: string[]) => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

const useStyles = makeStyles(theme => ({
  trigger: {
    cursor: 'pointer',
    '& input': { cursor: 'pointer' },
  },
  list: {
    minWidth: 220,
    padding: theme.spacing(1, 0),
  },
  checkbox: { padding: theme.spacing(0.5) },
}));

/**
 * Multi-select environment picker (checkbox popover). Observer cost data is
 * per-environment; the page aggregates across every selected environment.
 */
export const EnvironmentMultiSelect: FC<EnvironmentMultiSelectProps> = ({
  environments,
  value,
  onChange,
  loading = false,
  disabled = false,
  fullWidth = true,
  size = 'medium',
}) => {
  const classes = useStyles();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const toggle = (name: string) => {
    const next = value.includes(name)
      ? value.filter(v => v !== name)
      : [...value, name];
    onChange(next);
  };

  const selectedSet = new Set(value);
  const triggerLabel = (() => {
    if (value.length === 0) return 'Select environments';
    return value
      .map(name => environments.find(e => e.name === name)?.displayName || name)
      .join(', ');
  })();

  if (loading) {
    return <Skeleton variant="rect" height={size === 'small' ? 40 : 56} />;
  }

  return (
    <>
      <div ref={anchorRef}>
        <TextField
          fullWidth={fullWidth}
          size={size}
          disabled={disabled}
          variant="outlined"
          label="Environments"
          value={triggerLabel}
          onClick={() => !disabled && setOpen(true)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ 'aria-label': 'Environments' }}
          InputProps={{
            readOnly: true,
            classes: { root: classes.trigger },
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDropDownIcon />
              </InputAdornment>
            ),
          }}
        />
      </div>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuList className={classes.list} disablePadding>
          {environments.length === 0 && (
            <MenuItem disabled>No environments</MenuItem>
          )}
          {environments.map(env => (
            <MenuItem key={env.name} onClick={() => toggle(env.name)} dense>
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  className={classes.checkbox}
                  checked={selectedSet.has(env.name)}
                  tabIndex={-1}
                  disableRipple
                  color="primary"
                />
              </ListItemIcon>
              <ListItemText primary={env.displayName || env.name} />
            </MenuItem>
          ))}
        </MenuList>
      </Popover>
    </>
  );
};
