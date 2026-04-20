import { makeStyles } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';

export const useStyles = makeStyles(theme => ({
  dataplaneDetailsSection: {},
  environmentCard: {
    borderRadius: 8,
    height: '100%',
  },
  environmentHeader: {
    padding: theme.spacing(2),
    borderBottom: `1px solid ${
      theme.palette.type === 'dark' ? darkTokens.border.subtle : lightTokens.grey[100]
    }`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  environmentName: {
    // Original: `#111827`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.primary : lightTokens.common.black,
    marginBottom: theme.spacing(0.5),
  },
  environmentChip: {
    fontSize: '0.75rem',
    height: 24,
    fontWeight: 500,
  },
  productionChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    border: `1px solid ${theme.palette.success.main}`,
  },
  nonProductionChip: {
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.primary.dark,
    border: `1px solid ${theme.palette.primary.main}`,
  },
  environmentContent: {
    padding: 12,
  },
  environmentDetail: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    '&:last-child': {
      marginBottom: 0,
    },
  },
  environmentLabel: {
    fontSize: '0.875rem',
    // Original: `#6b7280`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.secondary : lightTokens.secondary.main,
    fontWeight: 500,
  },
  environmentValue: {
    fontSize: '0.875rem',
    // Original: `#374151`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.primary : lightTokens.secondary.dark,
  },
  componentCount: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    backgroundColor: theme.palette.infoBackground,
    color: theme.palette.primary.dark,
    padding: '2px 8px',
    borderRadius: 8,
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  componentCountIcon: {
    fontSize: '0.875rem',
  },
  environmentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    // Original: `#6b7280`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.secondary : lightTokens.secondary.main,
    fontStyle: 'italic',
  },
  emptyStateIcon: {
    fontSize: '3rem',
    opacity: 0.3,
    marginBottom: theme.spacing(2),
  },
  emptyStateTitle: {
    marginBottom: theme.spacing(1),
  },
  planeSection: {
    marginBottom: theme.spacing(3),
  },
  planeSectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '1rem',
    fontWeight: 600,
    // Original: `#6b7280`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.secondary : lightTokens.secondary.main,
    marginBottom: theme.spacing(2),
  },
  planeSectionIcon: {
    fontSize: '1.1rem',
    // Original: `#9ca3af`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.verySubtle : lightTokens.grey[400],
  },
  planeColumnCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  planeCompactCard: {
    borderRadius: 10,
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  planeCardActionArea: {
    '&&': {
      padding: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    '&.Mui-focusVisible': {
      backgroundColor: theme.palette.action.hover,
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  planeCompactInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  planeIcon: {
    fontSize: '1.25rem',
    // Original: `#6b7280`.
    color:
      theme.palette.type === 'dark' ? darkTokens.text.secondary : lightTokens.secondary.main,
  },
  agentDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  agentDotConnected: {
    backgroundColor: theme.palette.success.main,
  },
  agentDotDisconnected: {
    backgroundColor: theme.palette.error.main,
  },
}));
