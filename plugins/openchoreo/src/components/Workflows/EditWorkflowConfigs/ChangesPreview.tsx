import { Box, Typography } from '@material-ui/core';
import { useEditWorkflowStyles } from './styles';

export interface Change {
  path: string;
  type: 'new' | 'modified' | 'removed';
  oldValue?: any;
  newValue?: any;
}

interface ChangesPreviewProps {
  changes: Change[];
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const ChangesPreview: React.FC<ChangesPreviewProps> = ({ changes }) => {
  const classes = useEditWorkflowStyles();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Confirm Changes ({changes.length}{' '}
        {changes.length === 1 ? 'change' : 'changes'})
      </Typography>
      <Box className={classes.changesPreview}>
        {changes.map((change, index) => (
          <Box
            key={index}
            mb={index < changes.length - 1 ? 1.5 : 0}
            style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
          >
            {change.type === 'new' && (
              <Typography style={{ color: '#2e7d32' }}>
                <strong>{change.path}:</strong>{' '}
                <span style={{ color: '#666' }}>[New]</span>{' '}
                {formatValue(change.newValue)}
              </Typography>
            )}
            {change.type === 'modified' && (
              <Typography style={{ color: '#ed6c02' }}>
                <strong>{change.path}:</strong> {formatValue(change.oldValue)} →{' '}
                {formatValue(change.newValue)}
              </Typography>
            )}
            {change.type === 'removed' && (
              <Typography style={{ color: '#d32f2f' }}>
                <strong>{change.path}:</strong>{' '}
                <span style={{ color: '#666' }}>[Removed]</span>{' '}
                {formatValue(change.oldValue)}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      <Typography variant="body2" color="textSecondary">
        This will update the workflow configuration for the component.
      </Typography>
    </Box>
  );
};
