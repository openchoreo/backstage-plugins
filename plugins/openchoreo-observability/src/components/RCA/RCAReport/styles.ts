import { makeStyles } from '@material-ui/core/styles';

export const useRCAReportStyles = makeStyles(theme => ({
  header: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  backButton: {
    marginRight: theme.spacing(1),
  },
  titleContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontWeight: 600,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: theme.spacing(2),
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  cardTitleIcon: {
    color: theme.palette.primary.main,
    fontSize: theme.typography.h3.fontSize,
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
  },
  timelineContainer: {},
  stepRationale: {
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.25),
  },
  stepOutcomeBox: {
    marginTop: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  timelineHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(0.25),
  },
  timelineEventText: {
    fontWeight: 500,
  },
  infoCardSpacing: {
    marginBottom: theme.spacing(3),
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
  },
  summaryLabel: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
  },
  summaryValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '60%',
    textAlign: 'right',
  },
}));
