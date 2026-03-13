import React, { useState, useRef, useCallback } from 'react';
import {
  Button,
  ButtonGroup,
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Tooltip,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useStyles } from './styles';

/** A single option in the split button dropdown. */
export interface SplitButtonOption {
  /** Unique key for the option */
  key: string;
  /** Display label */
  label: string;
  /** Icon shown as start icon when this option is the primary action */
  icon?: React.ReactNode;
  /** Whether this option is disabled */
  disabled?: boolean;
}

export interface SplitButtonProps {
  /** Available actions. The first option is the default primary action. */
  options: SplitButtonOption[];
  /**
   * Called when the primary button is clicked.
   * Receives the key of the currently selected option.
   */
  onClick: (key: string) => void;
  /** Whether the entire button group is disabled */
  disabled?: boolean;
  /** Loading icon to replace the start icon while an action is in progress */
  loadingIcon?: React.ReactNode;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Tooltip text shown on hover. Empty string or undefined disables the tooltip. */
  tooltip?: string;
  /** Button color @default "primary" */
  color?: 'primary' | 'secondary' | 'default';
  /** Button variant @default "contained" */
  variant?: 'contained' | 'outlined' | 'text';
}

/**
 * SplitButton — A button with a dropdown to select between multiple actions.
 *
 * Selecting an option from the dropdown sets it as the primary button action
 * without triggering it. The user must click the primary button to execute.
 *
 * @example
 * ```tsx
 * <SplitButton
 *   options={[
 *     { key: 'build-latest', label: 'Build Latest', icon: <PlayArrowIcon /> },
 *     { key: 'build-custom', label: 'Custom Build' },
 *   ]}
 *   onClick={key => {
 *     if (key === 'build-latest') triggerBuild();
 *     else openParamsDialog();
 *   }}
 * />
 * ```
 */
export const SplitButton: React.FC<SplitButtonProps> = ({
  options,
  onClick,
  disabled = false,
  loadingIcon,
  loading = false,
  tooltip = '',
  color = 'primary',
  variant = 'contained',
}) => {
  const classes = useStyles();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const selectedOption = options[selectedIndex] ?? options[0];

  const handlePrimaryClick = useCallback(() => {
    if (selectedOption) {
      onClick(selectedOption.key);
    }
  }, [onClick, selectedOption]);

  const handleMenuItemClick = useCallback((index: number) => {
    setSelectedIndex(index);
    setMenuOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setMenuOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(
    (event: React.MouseEvent<Document, MouseEvent>) => {
      if (
        anchorRef.current &&
        anchorRef.current.contains(event.target as HTMLElement)
      ) {
        return;
      }
      setMenuOpen(false);
    },
    [],
  );

  const startIcon =
    loading && loadingIcon ? loadingIcon : selectedOption?.icon ?? undefined;

  return (
    <>
      <Tooltip title={tooltip}>
        <ButtonGroup
          variant={variant}
          color={color}
          ref={anchorRef}
          disabled={disabled || loading}
          aria-label="split button"
          className={classes.buttonGroup}
        >
          <Button onClick={handlePrimaryClick} startIcon={startIcon}>
            {selectedOption?.label}
          </Button>
          <Button
            size="small"
            onClick={handleToggle}
            className={classes.dropdownButton}
            aria-label="select action"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
      </Tooltip>
      <Popper
        open={menuOpen}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        style={{ zIndex: 1 }}
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin:
                placement === 'bottom' ? 'center top' : 'center bottom',
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList autoFocusItem={menuOpen}>
                  {options.map((option, index) => (
                    <MenuItem
                      key={option.key}
                      selected={index === selectedIndex}
                      disabled={option.disabled}
                      onClick={() => handleMenuItemClick(index)}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
};

SplitButton.displayName = 'SplitButton';
