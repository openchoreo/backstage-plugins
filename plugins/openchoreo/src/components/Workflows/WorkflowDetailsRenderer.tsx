import React from 'react';
import {
  Typography,
  Box,
  Grid,
} from '@material-ui/core';
import { useWorkflowStyles } from './styles';

interface WorkflowDetailsRendererProps {
  data: any;
  parentKey?: string;
  compact?: boolean;
}

export const WorkflowDetailsRenderer: React.FC<WorkflowDetailsRendererProps> = ({
  data,
  parentKey = '',
  compact = false,
}) => {
  const classes = useWorkflowStyles();

  if (data === null || data === undefined || data === '') {
    return <Typography className={classes.emptyValue}>Not specified</Typography>;
  }

  // Primitive values (string, number, boolean)
  if (typeof data !== 'object') {
    const value = String(data);
    const isUrl = value.startsWith('http://') || value.startsWith('https://');
    const isPath = value.startsWith('/') || value.startsWith('./');

    if (isUrl) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={classes.linkValue}
        >
          {value}
        </a>
      );
    }

    if (isPath || value.length < 50) {
      return <code className={classes.propertyValueCode}>{value}</code>;
    }

    return <span className={classes.propertyValue}>{value}</span>;
  }

  // Arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <Typography className={classes.emptyValue}>Empty list</Typography>;
    }

    // Check if all items are primitives (not objects)
    const allPrimitives = data.every(item => typeof item !== 'object' || item === null);

    // For arrays of primitive values, render inline with comma separation
    if (allPrimitives) {
      const arrayValue = `[ ${data.map(item => {
        if (typeof item === 'string') {
          return `"${item}"`;
        }
        return String(item);
      }).join(', ')} ]`;
      return <code className={classes.propertyValueCode}>{arrayValue}</code>;
    }

    // For arrays of objects, render vertically
    return (
      <Box>
        {data.map((item, index) => (
          <Box key={index} className={classes.nestedSection}>
            <WorkflowDetailsRenderer data={item} parentKey={`${parentKey}[${index}]`} />
          </Box>
        ))}
      </Box>
    );
  }

  // Objects - render as key-value pairs
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return <Typography className={classes.emptyValue}>Empty object</Typography>;
  }

  // Check if this is a simple object (all values are primitives or single-level objects)
  const isSimpleObject = entries.every(([_, value]) => {
    if (typeof value !== 'object' || value === null) return true;
    if (Array.isArray(value)) return value.length <= 1;
    return Object.values(value).every(v => typeof v !== 'object' || v === null);
  });

  // Check if we're at the top level (root of schema)
  const isTopLevel = parentKey === '';

  // For top-level with objects, show each as a separate section
  if (isTopLevel) {
    return (
      <Box>
        {entries.map(([key, value]) => {
          const isObjectValue = typeof value === 'object' && value !== null && !Array.isArray(value);

          if (isObjectValue) {
            return (
              <Box key={key} className={classes.nestedSection}>
                <Typography variant="h5" className={classes.nestedSectionTitle}>
                  {formatKey(key)}
                </Typography>
                <WorkflowDetailsRenderer data={value} parentKey={`${parentKey}.${key}`} compact />
              </Box>
            );
          }

          // Simple value at top level
          return (
            <Box key={key} className={classes.propertyRow} style={{ marginTop: '16px', marginBottom: '12px' }}>
              <Typography className={classes.propertyKey}>
                {formatKey(key)}:
              </Typography>
              <WorkflowDetailsRenderer
                data={value}
                parentKey={`${parentKey}.${key}`}
                compact
              />
            </Box>
          );
        })}
      </Box>
    );
  }

  // For non-top-level simple objects, use grid layout for horizontal space
  if (!compact && isSimpleObject) {
    return (
      <Grid container spacing={2}>
        {entries.map(([key, value]) => (
          <Grid item xs={12} sm={6} md={4} key={key}>
            <Box className={classes.propertyCard}>
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  {formatKey(key)}:
                </Typography>
                <WorkflowDetailsRenderer
                  data={value}
                  parentKey={`${parentKey}.${key}`}
                  compact
                />
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  }

  // For nested objects, check if we need accordion or simple rendering
  const hasComplexNesting = entries.some(([_, value]) => {
    if (typeof value !== 'object' || value === null) return false;
    if (Array.isArray(value)) return value.length > 1 || (value[0] && typeof value[0] === 'object');
    return Object.keys(value).length > 3;
  });

  // Simple nested object - render in a compact grid
  if (!hasComplexNesting) {
    return (
      <Grid container spacing={1}>
        {entries.map(([key, value]) => (
          <Grid item xs={12} sm={6} key={key}>
            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>
                {formatKey(key)}:
              </Typography>
              <WorkflowDetailsRenderer
                data={value}
                parentKey={`${parentKey}.${key}`}
                compact
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  }

  // Complex nested object - use clean sections
  return (
    <Box>
      {entries.map(([key, value]) => {
        const isComplexValue =
          typeof value === 'object' &&
          value !== null &&
          (Array.isArray(value) ? value.length > 1 : Object.keys(value).length > 2);

        if (isComplexValue) {
          // Use subtle section for nested complex data
          return (
            <Box key={key} className={classes.nestedSection}>
              <Typography variant="h5" className={classes.nestedSectionTitle}>
                {formatKey(key)}
              </Typography>
              <WorkflowDetailsRenderer data={value} parentKey={`${parentKey}.${key}`} compact />
            </Box>
          );
        }

        return (
          <Box key={key} className={classes.propertyRow} style={{ marginBottom: '12px' }}>
            <Typography className={classes.propertyKey}>
              {formatKey(key)}:
            </Typography>
            <WorkflowDetailsRenderer
              data={value}
              parentKey={`${parentKey}.${key}`}
              compact
            />
          </Box>
        );
      })}
    </Box>
  );
};

// Helper function to format keys (convert camelCase to Title Case)
const formatKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};
