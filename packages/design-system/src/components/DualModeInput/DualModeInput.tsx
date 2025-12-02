import type { FC, ReactNode } from 'react';
import { IconButton, Box, Tooltip } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  toggleButton: {
    marginRight: theme.spacing(1),
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    borderRadius: 8,
    padding: theme.spacing(1),
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.text.primary,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transform: 'translateY(-1px)',
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  toggleButtonSecret: {
    color: theme.palette.primary.main,
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
  content: {
    flex: 1,
  },
}));

export type DualModeType = 'plain' | 'secret';

export interface DualModeInputProps {
  /** Current mode - 'plain' for regular input, 'secret' for secret reference */
  mode: DualModeType;
  /** Callback when mode is toggled */
  onModeChange: (mode: DualModeType) => void;
  /** Content to render when in plain mode */
  plainContent: ReactNode;
  /** Content to render when in secret mode */
  secretContent: ReactNode;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Tooltip text when in plain mode (default: "Click to switch to secret reference") */
  tooltipPlain?: string;
  /** Tooltip text when in secret mode (default: "Click to switch to plain value") */
  tooltipSecret?: string;
}

/**
 * A generic dual-mode input component that allows switching between plain value and secret reference modes.
 * Displays a lock icon button to toggle between modes and renders the appropriate content.
 */
export const DualModeInput: FC<DualModeInputProps> = ({
  mode,
  onModeChange,
  plainContent,
  secretContent,
  disabled = false,
  tooltipPlain = 'Click to switch to secret reference',
  tooltipSecret = 'Click to switch to plain value',
}) => {
  const classes = useStyles();
  const isSecret = mode === 'secret';

  const handleToggle = () => {
    onModeChange(isSecret ? 'plain' : 'secret');
  };

  return (
    <Box className={classes.container}>
      <Tooltip title={isSecret ? tooltipSecret : tooltipPlain}>
        <IconButton
          onClick={handleToggle}
          size="small"
          disabled={disabled}
          className={`${classes.toggleButton} ${
            isSecret ? classes.toggleButtonSecret : ''
          }`}
          color={isSecret ? 'primary' : 'default'}
          aria-label={
            isSecret ? 'Switch to plain value' : 'Switch to secret reference'
          }
        >
          {isSecret ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
      </Tooltip>
      <Box className={classes.content}>
        {isSecret ? secretContent : plainContent}
      </Box>
    </Box>
  );
};
