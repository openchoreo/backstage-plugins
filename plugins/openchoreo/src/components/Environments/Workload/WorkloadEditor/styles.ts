import { makeStyles } from '@material-ui/core/styles';

export const useWorkloadEditorStyles = makeStyles(theme => ({
  // Accordion styles
  accordion: {
    // No margin bottom for all accordions
    '&.Mui-expanded': {
      margin: 0,
    },
  },
  
  // Container styles for dynamic fields (cards)
  dynamicFieldContainer: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  
  // Environment variable container styles
  envVarContainer: {
    padding: theme.spacing(1),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
  },
  
  // Button styles
  addButton: {
    marginTop: theme.spacing(1),
  },
  
  // Common layout utilities
  fullWidth: {
    width: '100%',
  },
  
  // Flex utilities
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));