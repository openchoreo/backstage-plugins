import { useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Fab,
  IconButton,
  Paper,
  Slide,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import CloseIcon from '@material-ui/icons/Close';

const useStyles = makeStyles(theme => ({
  root: {
    position: 'fixed',
    right: theme.spacing(3),
    bottom: theme.spacing(3),
    zIndex: theme.zIndex.snackbar,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
  },
  panelWrap: {
    width: 340,
    maxWidth: `calc(100vw - ${theme.spacing(6)}px)`,
  },
  panel: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius * 2,
    boxShadow: theme.shadows[6],
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5),
  },
  name: {
    fontWeight: 600,
    fontSize: 13,
  },
  bubble: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.shape.borderRadius,
    fontSize: 13,
    lineHeight: 1.4,
    color: theme.palette.text.primary,
    '& code': {
      fontSize: 12,
      padding: '1px 4px',
      borderRadius: 3,
      backgroundColor: theme.palette.action.hover,
    },
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  closeBtn: {
    padding: 2,
  },
  fab: {
    boxShadow: theme.shadows[6],
  },
}));

export type AssistantPromptLauncherProps = {
  /** Header label for the popup. Defaults to "Perch". */
  title?: string;
  /** Body of the chat bubble — usually a short message from the assistant. */
  message: ReactNode;
  /** Primary CTA label (e.g. "Investigate"). Required. */
  primaryActionLabel: string;
  /** Called when the user clicks the primary CTA. */
  onPrimaryAction: () => void;
  /** Secondary CTA label (e.g. "Not now"). Defaults to "Not now". */
  secondaryActionLabel?: string;
  /** Optional secondary CTA handler. Defaults to closing the popup. */
  onSecondaryAction?: () => void;
  /** Tooltip for the chat-icon FAB. Defaults to "Open Perch". */
  fabTooltip?: string;
  /** Aria-label for the launcher FAB. Defaults to "Open Perch". */
  fabAriaLabel?: string;
  /**
   * Whether the popup is open on first mount. Defaults to true so the
   * prompt is noticed in context (e.g. on a failed build). Dismissing
   * collapses to the icon — re-clicking the icon re-opens.
   */
  defaultOpen?: boolean;
};

/**
 * Floating chat-icon launcher anchored bottom-right that expands into a
 * small assistant chat-bubble popup. Used by context-aware triggers
 * (failed build, component create) to surface a guided assistant prompt
 * without taking over the page.
 *
 * Single source of truth for the launcher UX so the FailedBuildSnackbar
 * and ComponentCreatePrompt stay visually consistent.
 */
export const AssistantPromptLauncher = ({
  title = 'Perch',
  message,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel = 'Not now',
  onSecondaryAction,
  fabTooltip = 'Open Perch',
  fabAriaLabel = 'Open Perch',
  defaultOpen = true,
}: AssistantPromptLauncherProps) => {
  const classes = useStyles();
  const [open, setOpen] = useState(defaultOpen);

  const handleSecondary = () => {
    if (onSecondaryAction) onSecondaryAction();
    setOpen(false);
  };

  const handlePrimary = () => {
    onPrimaryAction();
    setOpen(false);
  };

  return (
    <div className={classes.root}>
      <Slide direction="up" in={open} mountOnEnter unmountOnExit>
        <div className={classes.panelWrap}>
          <Paper className={classes.panel} elevation={6}>
            <Box className={classes.header}>
              <Typography className={classes.name}>{title}</Typography>
              <IconButton
                size="small"
                className={classes.closeBtn}
                onClick={() => setOpen(false)}
                aria-label={`Dismiss ${title || 'Perch prompt'}`}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box className={classes.bubble}>{message}</Box>
            <Box className={classes.actions}>
              <Button size="small" onClick={handleSecondary}>
                {secondaryActionLabel}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="primary"
                onClick={handlePrimary}
              >
                {primaryActionLabel}
              </Button>
            </Box>
          </Paper>
        </div>
      </Slide>
      <Tooltip title={fabTooltip} placement="left">
        <Fab
          color="primary"
          size="medium"
          className={classes.fab}
          onClick={() => setOpen(prev => !prev)}
          aria-label={fabAriaLabel}
          aria-expanded={open}
        >
          <ChatOutlinedIcon />
        </Fab>
      </Tooltip>
    </div>
  );
};
