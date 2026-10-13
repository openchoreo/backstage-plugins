import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  promotionPathHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(1.5),
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
  removeButton: {
    color: theme.palette.text.secondary,
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
    fontSize: '0.75rem',
  },
  // A section of its own in the environment form: divider above, and a
  // heading that outranks the Before / After deploy phase titles.
  hooksSection: {
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  // Explicit sizes: the portal theme shrinks the heading variants. The
  // section sits inside the Environment form, so it never outranks the
  // page title; the phase titles sit one step below it.
  hooksTitle: {
    fontSize: '1rem',
    lineHeight: 1.4,
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  phaseTitle: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  emptyPhase: {
    marginTop: theme.spacing(1),
    fontStyle: 'italic',
  },
  hookBindingCard: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
}));
