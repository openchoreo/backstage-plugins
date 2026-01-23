import { makeStyles } from '@material-ui/core/styles';

export const useRCAReportStyles = makeStyles(theme => ({
  header: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
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
    paddingTop: theme.spacing(1),
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
  numberedDot: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  dotNumber: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
    color: theme.palette.primary.contrastText,
    lineHeight: 1,
  },
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
    marginBottom: theme.spacing(1),
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
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 500,
    marginBottom: theme.spacing(0.5),
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
  overviewMetaValue: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
  sidebarColumn: {},
  chatPanelWrapper: {
    height: `calc(100vh - 240px)`,
    marginBottom: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
  },
  chatPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    '& > div:first-child': {
      alignItems: 'center',
    },
    '& > div:last-child': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      padding: 0,
    },
  },
  chatContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    overflow: 'auto',
    padding: theme.spacing(2),
  },
  chatMessageUser: {
    alignSelf: 'flex-end',
    backgroundColor: theme.palette.primary.main,
    borderRadius: theme.spacing(2),
    borderBottomRightRadius: theme.spacing(0.5),
    padding: theme.spacing(1, 1.5),
    maxWidth: '85%',
    '& p, & span, & li, & strong, & em, & a': {
      color: theme.palette.primary.contrastText,
    },
    '& code': {
      color: theme.palette.primary.contrastText,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
  },
  chatMessageAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.spacing(2),
    borderBottomLeftRadius: theme.spacing(0.5),
    padding: theme.spacing(1, 1.5),
    maxWidth: '85%',
  },
  chatInputArea: {
    padding: theme.spacing(0.25, 0.5, 0.5, 0.5),
    marginTop: 'auto',
    '& .MuiOutlinedInput-adornedEnd': {
      paddingRight: theme.spacing(0.25),
    },
  },
  statusStrip: {
    padding: theme.spacing(0.25, 2, 0, 2),
    textAlign: 'center',
  },
  statusText: {
    color: theme.palette.text.secondary,
    animation: '$pulse 1.5s ease-in-out infinite',
  },
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.4,
    },
  },
  inputPulsing: {
    '& .MuiOutlinedInput-notchedOutline': {
      animation: '$pulse 1.5s ease-in-out infinite',
    },
  },
  buttonPulsing: {
    animation: '$pulse 1.5s ease-in-out infinite',
  },
  markdownContent: {
    fontSize: theme.typography.body2.fontSize,
    lineHeight: 1.6,
    '& p': {
      margin: 0,
      marginBottom: theme.spacing(1),
      '&:last-child': {
        marginBottom: 0,
      },
    },
    '& ul, & ol': {
      margin: 0,
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(2.5),
      '&:last-child': {
        marginBottom: 0,
      },
    },
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
    '& code': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.primary.main,
      padding: '2px 6px',
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: '0.85em',
    },
    '& pre': {
      backgroundColor: theme.palette.background.default,
      padding: theme.spacing(1.5),
      borderRadius: theme.shape.borderRadius,
      overflow: 'auto',
      marginBottom: theme.spacing(1),
      '& code': {
        backgroundColor: 'transparent',
        color: theme.palette.text.secondary,
        padding: 0,
      },
    },
    '& strong': {
      fontWeight: 600,
      color: 'inherit',
    },
    '& em': {
      fontStyle: 'italic',
    },
    '& a': {
      color: theme.palette.primary.main,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
      '& strong': {
        color: theme.palette.primary.main,
      },
    },
    '& blockquote': {
      borderLeft: `3px solid ${theme.palette.primary.main}`,
      margin: 0,
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(1.5),
      color: theme.palette.text.secondary,
      fontStyle: 'italic',
    },
    '& h1': {
      fontSize: '1.1em',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
      fontWeight: 600,
    },
    '& h2': {
      fontSize: '1.05em',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
      fontWeight: 600,
    },
    '& h3, & h4, & h5, & h6': {
      fontSize: '1em',
      marginTop: theme.spacing(0.75),
      marginBottom: theme.spacing(0.5),
      fontWeight: 600,
    },
    '& h1:first-child, & h2:first-child, & h3:first-child': {
      marginTop: 0,
    },
    '& hr': {
      border: 'none',
      borderTop: `1px solid ${theme.palette.divider}`,
      margin: theme.spacing(1.5, 0),
    },
    '& table': {
      display: 'block',
      width: '100%',
      overflowX: 'auto',
      borderCollapse: 'collapse',
      marginBottom: theme.spacing(1),
      fontSize: '0.85em',
      whiteSpace: 'nowrap',
      // Thin scrollbar
      '&::-webkit-scrollbar': {
        height: 6,
      },
      '&::-webkit-scrollbar-track': {
        backgroundColor: theme.palette.action.hover,
        borderRadius: 3,
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: theme.palette.action.disabled,
        borderRadius: 3,
        '&:hover': {
          backgroundColor: theme.palette.action.active,
        },
      },
      scrollbarWidth: 'thin',
      '&:last-child': {
        marginBottom: 0,
      },
    },
    '& th, & td': {
      border: `1px solid ${theme.palette.divider}`,
      padding: theme.spacing(0.75, 1),
      textAlign: 'left',
    },
    '& th': {
      backgroundColor: theme.palette.action.hover,
      fontWeight: 600,
    },
    '& tr:nth-child(even)': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  chatError: {
    padding: theme.spacing(0.5, 1),
    backgroundColor: theme.palette.error.light,
    textAlign: 'center',
  },
  severityBadge: {
    display: 'inline-block',
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.borderRadius,
    fontWeight: 600,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  severityCritical: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  severityWarning: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  severityNormal: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  outcomeBadge: {
    display: 'inline-block',
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.borderRadius,
    fontWeight: 600,
    fontSize: theme.typography.caption.fontSize,
    letterSpacing: '0.5px',
  },
  outcomeNoAnomaly: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  outcomeInsufficientData: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  outcomeTransient: {
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[700],
  },
  outcomeExternal: {
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.grey[800],
  },
  outcomeSection: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
    borderLeft: `4px solid ${theme.palette.warning.main}`,
  },
  outcomeSectionTransient: {
    borderLeftColor: theme.palette.grey[400],
  },
  outcomeSectionNoAnomaly: {
    borderLeftColor: theme.palette.success.main,
  },
  outcomeSectionInsufficientData: {
    borderLeftColor: theme.palette.warning.main,
  },
  outcomeSectionExternal: {
    borderLeftColor: theme.palette.grey[500],
  },
  outcomeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  outcomeTitle: {
    fontSize: theme.typography.body1.fontSize,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  outcomeExplanation: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    lineHeight: 1.6,
  },
  assessmentExplanation: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    lineHeight: 1.6,
    marginTop: theme.spacing(1.5),
  },
  summaryText: {
    fontSize: theme.typography.body1.fontSize,
    lineHeight: 1.7,
  },
  // Alert Context pane styles
  alertContextHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  },
  alertContextName: {
    fontSize: theme.typography.h6.fontSize,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  alertContextDescriptionInline: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  // Property row pattern (consistent with rest of repo)
  propertyGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
  },
  propertyKey: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    minWidth: 100,
    flexShrink: 0,
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  propertyValueHighlight: {
    fontWeight: 600,
    color: theme.palette.warning.main,
  },
  alertContextQueryBox: {
    marginTop: theme.spacing(1),
  },
  alertContextQuery: {
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.text.primary,
    wordBreak: 'break-word',
    marginTop: theme.spacing(0.5),
  },
  overviewDivider: {
    borderTop: `1px solid ${theme.palette.divider}`,
    margin: theme.spacing(2, 0),
  },
}));
