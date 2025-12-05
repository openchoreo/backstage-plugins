import { makeStyles } from '@material-ui/core/styles';

export const useProjectOverviewCardStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '12px !important',
    border: '1px solid rgb(243, 244, 246) !important',
    boxShadow:
      'rgba(0, 0, 0, 0.05) 0px 1px 3px 0px, rgba(0, 0, 0, 0.03) 0px 1px 2px 0px !important',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  cardTitle: {
    fontWeight: 600,
    fontSize: theme.typography.h6.fontSize,
    color: theme.palette.text.primary,
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(3.5),
  },
  environmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  environmentLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    minWidth: '90px',
    fontWeight: 500,
  },
  progressBarContainer: {
    flex: 1,
    height: '8px',
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.spacing(1),
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: theme.spacing(1),
    transition: 'width 0.3s ease-in-out',
  },
  progressText: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    fontWeight: 500,
    minWidth: '40px',
    textAlign: 'right',
  },
  summary: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
  },
  pipelineInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  infoRow: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1.5),
    gap: theme.spacing(1),
  },
  infoLabel: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    minWidth: '80px',
  },
  infoValue: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
  environmentFlow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  environmentChip: {
    padding: theme.spacing(0.5, 1.5),
    backgroundColor: theme.palette.primary.light,
    borderRadius: theme.spacing(1),
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    border: `1.5px solid ${theme.palette.primary.dark}`,
    color: theme.palette.primary.dark,
  },
  arrow: {
    color: theme.palette.text.secondary,
    fontSize: '1rem',
  },
  disabledState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    flex: 1,
  },
  disabledIcon: {
    fontSize: '2.5rem',
    color: theme.palette.action.disabled,
    marginBottom: theme.spacing(1),
  },
}));
