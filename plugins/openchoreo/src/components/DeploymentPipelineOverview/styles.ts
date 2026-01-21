import { makeStyles } from '@material-ui/core/styles';

export const useDeploymentPipelineOverviewStyles = makeStyles(theme => ({
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
  },
  pipelineVisualization: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    flexWrap: 'wrap',
  },
  environmentNode: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  environmentChip: {
    padding: theme.spacing(1, 2),
    borderRadius: theme.spacing(1.5),
    fontSize: theme.typography.body1.fontSize,
    fontWeight: 600,
    minWidth: '100px',
    textAlign: 'center',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  },
  productionChip: {
    backgroundColor: theme.palette.grey[100],
    borderColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  stagingChip: {
    backgroundColor: theme.palette.grey[100],
    borderColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  devChip: {
    backgroundColor: theme.palette.grey[100],
    borderColor: theme.palette.info.light,
    color: theme.palette.info.dark,
  },
  defaultChip: {
    backgroundColor: theme.palette.grey[50],
    borderColor: theme.palette.grey[300],
    color: theme.palette.grey[700],
  },
  componentCount: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
  },
  healthIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  healthyDot: {
    backgroundColor: theme.palette.success.main,
  },
  warningDot: {
    backgroundColor: theme.palette.warning.main,
  },
  errorDot: {
    backgroundColor: theme.palette.error.main,
  },
  arrow: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.secondary,
    fontSize: '1.5rem',
  },
  arrowWithLock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  lockIcon: {
    fontSize: '0.875rem',
    color: theme.palette.warning.main,
  },
  tableContainer: {
    marginTop: theme.spacing(2),
    '& th': {
      fontWeight: 600,
      backgroundColor: theme.palette.background.default,
    },
  },
  componentLink: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  versionChip: {
    fontSize: '0.75rem',
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.text.primary,
  },
  statusIcon: {
    fontSize: '1rem',
    verticalAlign: 'middle',
  },
  statusHealthy: {
    color: theme.palette.success.main,
  },
  statusWarning: {
    color: theme.palette.warning.main,
  },
  statusError: {
    color: theme.palette.error.main,
  },
  promotionPathList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  promotionPathItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    '&:last-child': {
      marginBottom: 0,
    },
  },
  pathSource: {
    fontWeight: 500,
    color: theme.palette.text.primary,
    minWidth: '100px',
  },
  pathArrow: {
    color: theme.palette.text.secondary,
    fontSize: '1.25rem',
  },
  pathTarget: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  pathTargetName: {
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  approvalBadge: {
    fontSize: theme.typography.caption.fontSize,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  autoBadge: {
    fontSize: theme.typography.caption.fontSize,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: theme.spacing(0.5),
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
    flex: 1,
  },
  emptyIcon: {
    fontSize: '3rem',
    color: theme.palette.action.disabled,
    marginBottom: theme.spacing(2),
  },
  noticeBox: {
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
    marginTop: theme.spacing(2),
    fontSize: theme.typography.body2.fontSize,
  },
}));
