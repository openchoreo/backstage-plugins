import { useEffect, useState } from 'react';
import { Box, Typography, Chip, IconButton, Collapse } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { makeStyles } from '@material-ui/core/styles';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';

const useStyles = makeStyles(theme => ({
  container: {
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.common.white,
    borderRadius: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    padding: theme.spacing(0.5),
    margin: theme.spacing(-0.5),
    borderRadius: theme.shape.borderRadius,
    transition: 'background-color 0.2s ease',
  },
  readOnlyBadge: {
    height: 20,
    fontSize: 11,
    fontWeight: 500,
  },
  jsonContainer: {
    marginTop: theme.spacing(2),
    backgroundColor:
      theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
    overflow: 'auto',
    maxHeight: 400,
  },
  jsonContent: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: theme.palette.text.secondary,
    whiteSpace: 'pre',
    margin: 0,
  },
  noParameters: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    marginTop: theme.spacing(2),
  },
  error: {
    fontSize: 13,
    color: theme.palette.error.main,
  },
  expandIcon: {
    marginLeft: 'auto',
    transition: 'transform 0.2s ease',
    padding: theme.spacing(0.5),
  },
  expandIconExpanded: {
    transform: 'rotate(180deg)',
  },
}));

interface TraitParametersProps {
  entity: Entity;
  traitInstanceName: string;
}

export const TraitParameters: React.FC<TraitParametersProps> = ({
  entity,
  traitInstanceName,
}) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const [parameters, setParameters] = useState<Record<string, unknown> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchTraitParameters = async () => {
      try {
        setLoading(true);
        setError(null);
        const traits = await client.fetchComponentTraits(entity);
        const trait = traits.find(t => t.instanceName === traitInstanceName);
        if (trait) {
          setParameters(trait.parameters || {});
        } else {
          setError('Trait not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch trait');
      } finally {
        setLoading(false);
      }
    };

    fetchTraitParameters();
  }, [client, entity, traitInstanceName]);


  if (loading) {
    return null; // Silent loading to avoid flicker
  }

  if (error) {
    return (
      <Box className={classes.container}>
        <Typography className={classes.error}>{error}</Typography>
      </Box>
    );
  }

  const hasParameters = parameters && Object.keys(parameters).length > 0;

  return (
    <Box className={classes.container}>
      <Box className={classes.header} onClick={() => setExpanded(!expanded)}>
        <Typography variant='h5' color='textSecondary'>Configured Parameters</Typography>
        <Chip
          label="Read Only"
          size="small"
          className={classes.readOnlyBadge}
        />
        <IconButton
          size="small"
          className={`${classes.expandIcon} ${
            expanded ? classes.expandIconExpanded : ''
          }`}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        {hasParameters ? (
          <Box className={classes.jsonContainer}>
            <pre className={classes.jsonContent}>
              {JSON.stringify(parameters, null, 2)}
            </pre>
          </Box>
        ) : (
          <Typography className={classes.noParameters}>
            No parameters configured
          </Typography>
        )}
      </Collapse>
    </Box>
  );
};
