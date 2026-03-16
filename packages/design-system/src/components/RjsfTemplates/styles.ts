import { makeStyles, Theme } from '@material-ui/core/styles';

export const useArrayStyles = makeStyles((theme: Theme) => ({
  container: {
    marginBottom: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(1),
  },
  title: {
    fontWeight: 600,
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },

  // ── Edit mode ──────────────────────────────────────────────────────────
  editItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
    border: `2px solid ${theme.palette.primary.main}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
  },
  editActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingTop: theme.spacing(0.5),
    flexShrink: 0,
  },
  confirmButton: {
    padding: 4,
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },

  // ── Compact mode ───────────────────────────────────────────────────────
  compactItem: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
  },
  compactSummary: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.palette.text.primary,
  },
  emptyLabel: {
    fontStyle: 'italic',
    color: theme.palette.text.disabled,
  },
  compactActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    flexShrink: 0,
  },
  editButton: {
    textTransform: 'none',
    borderColor: theme.palette.divider,
    color: theme.palette.text.primary,
    '&:hover': {
      borderColor: theme.palette.text.secondary,
    },
  },

  // ── Shared ─────────────────────────────────────────────────────────────
  itemContent: {
    flex: 1,
    minWidth: 0,
    '& > .MuiFormControl-root:last-child': {
      marginBottom: 0,
    },
    '& > fieldset': {
      border: 'none',
      padding: 0,
      margin: 0,
    },
    '& > fieldset > legend': {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0,
    },
  },
  actionButton: {
    padding: 4,
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  deleteButton: {
    padding: 4,
    color: theme.palette.text.disabled,
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  addButton: {
    textTransform: 'none',
    marginTop: theme.spacing(0.5),
  },
}));
