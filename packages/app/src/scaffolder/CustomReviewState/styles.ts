import { makeStyles } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  reviewContent: {
    paddingLeft: theme.spacing(6),
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: theme.spacing(3),
    gap: theme.spacing(1),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
    fontWeight: 600,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  promotionFlow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  envBox: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  arrow: {
    color: theme.palette.text.secondary,
    fontSize: '1.25rem',
    margin: theme.spacing(0, 0.5),
  },
  promotionPathRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
    paddingLeft: theme.spacing(3),
  },
  subsectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    fontWeight: 500,
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
  },
}));
