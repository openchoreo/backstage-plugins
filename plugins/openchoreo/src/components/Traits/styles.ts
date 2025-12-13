import { makeStyles } from '@material-ui/core/styles';

export const useTraitsStyles = makeStyles(theme => ({
  // Main container
  container: {
    paddingRight: theme.spacing(3),
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  title: {
    margin: 0,
  },
  description: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
    marginBottom: 0,
  },

  // Unsaved changes banner
  unsavedBanner: {
    marginBottom: theme.spacing(3),
    backgroundColor: theme.palette.warning.light,
    // border: `1px solid ${theme.palette.warning.main}`,
    borderLeft: `4px solid ${theme.palette.warning.main}`,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unsavedText: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  unsavedIcon: {
    color: theme.palette.warning.main,
    fontSize: '2rem',
  },
  unsavedTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  unsavedMessage: {
    color: theme.palette.text.secondary,
  },
  unsavedActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },

  // Accordion styles
  accordion: {
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '8px !important',
    '&:before': {
      display: 'none',
    },
    '&.Mui-expanded': {
      margin: `0 0 ${theme.spacing(2)}px 0`,
    },
  },
  accordionSummary: {
    display: 'flex',
    alignItems: 'center',
    '& .MuiAccordionSummary-content': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    '&.Mui-expanded': {
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  accordionDeleted: {
    opacity: 0.6,
    backgroundColor: `${theme.palette.error.light}20`,
    '& $traitTitle': {
      textDecoration: 'line-through',
    },
  },
  accordionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flex: 1,
  },
  accordionRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  traitTitle: {
    fontWeight: 500,
  },
  traitType: {
    color: theme.palette.text.secondary,
    fontWeight: 400,
  },

  // Badge styles
  badge: {
    marginLeft: theme.spacing(1),
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  badgeModified: {
    borderColor: theme.palette.warning.main,
    color: theme.palette.warning.main,
  },
  badgeAdded: {
    borderColor: theme.palette.success.main,
    color: theme.palette.success.main,
  },
  badgeDeleted: {
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
  },

  // Parameters display
  parametersContainer: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  parametersTitle: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  parametersList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  parameterItem: {
    padding: theme.spacing(0.5, 0),
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  parameterKey: {
    color: theme.palette.primary.main,
    fontWeight: 500,
  },
  parameterValue: {
    color: theme.palette.text.primary,
  },
  noParameters: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },

  // Dialog styles
  dialogContent: {
    paddingTop: theme.spacing(4),
  },
  dialogField: {
    marginBottom: theme.spacing(2),
  },
  jsonEditor: {
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },

  // Diff display
  diffSection: {
    marginBottom: theme.spacing(3),
  },
  diffTitle: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  diffList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  diffItem: {
    padding: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  diffAdded: {
    backgroundColor: `${theme.palette.success.light}30`,
    borderLeft: `4px solid ${theme.palette.success.main}`,
  },
  diffModified: {
    backgroundColor: `${theme.palette.warning.light}30`,
    borderLeft: `4px solid ${theme.palette.warning.main}`,
  },
  diffDeleted: {
    backgroundColor: `${theme.palette.error.light}30`,
    borderLeft: `4px solid ${theme.palette.error.main}`,
    textDecoration: 'line-through',
  },
  diffNone: {
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));
