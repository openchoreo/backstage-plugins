import { Box, Typography, Button, makeStyles } from '@material-ui/core';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import clsx from 'clsx';
import { Link } from '@backstage/core-components';

export interface PipelineFlowVisualizationProps {
  environments: string[];
  highlightedEnvironment?: string;
  pipelineEntityRef?: string;
  pipelineName?: string;
  showPipelineLink?: boolean;
}

const useStyles = makeStyles(theme => ({
  pipelineFlow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  environmentChip: {
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.spacing(1),
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
  },
  currentEnvironment: {
    backgroundColor: '#10b981', // success.main - green to match graph labels
    color: '#ffffff',
    border: '2px solid #059669', // success.dark
  },
  otherEnvironment: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)', // transparent green
    color: '#059669', // success.dark - green text
    border: '1.5px solid #10b981', // success.main border
  },
  arrow: {
    color: theme.palette.text.secondary,
    fontSize: '1rem',
  },
  linkButton: {
    marginTop: theme.spacing(1),
    textTransform: 'none',
  },
}));

const capitalizeFirst = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const entityRefToUrl = (entityRef: string): string => {
  const colonIndex = entityRef.indexOf(':');
  if (colonIndex === -1) return `/catalog/default/${entityRef}`;

  const kind = entityRef.substring(0, colonIndex);
  const rest = entityRef.substring(colonIndex + 1);
  const slashIndex = rest.indexOf('/');

  if (slashIndex === -1) {
    return `/catalog/default/${kind}/${rest}`;
  }

  const namespace = rest.substring(0, slashIndex);
  const name = rest.substring(slashIndex + 1);
  return `/catalog/${namespace}/${kind}/${name}`;
};

export const PipelineFlowVisualization = ({
  environments,
  highlightedEnvironment,
  pipelineEntityRef,
  showPipelineLink = false,
}: PipelineFlowVisualizationProps) => {
  const classes = useStyles();

  return (
    <>
      <Box className={classes.pipelineFlow}>
        {environments.map((env, index) => {
          const isHighlighted =
            highlightedEnvironment?.toLowerCase() === env.toLowerCase();
          const chipContent = (
            <Typography
              className={clsx(
                classes.environmentChip,
                isHighlighted
                  ? classes.currentEnvironment
                  : classes.otherEnvironment,
              )}
            >
              {capitalizeFirst(env)}
            </Typography>
          );

          return (
            <Box
              key={env}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isHighlighted ? (
                chipContent
              ) : (
                <Link
                  to={`/catalog/default/environment/${env.toLowerCase()}`}
                  style={{ textDecoration: 'none' }}
                >
                  {chipContent}
                </Link>
              )}
              {index < environments.length - 1 && (
                <ArrowForwardIcon className={classes.arrow} />
              )}
            </Box>
          );
        })}
      </Box>

      {showPipelineLink && pipelineEntityRef && (
        <Link
          to={entityRefToUrl(pipelineEntityRef)}
          style={{ textDecoration: 'none' }}
        >
          <Button
            variant="text"
            color="primary"
            size="small"
            className={classes.linkButton}
          >
            View Pipeline Details
          </Button>
        </Link>
      )}
    </>
  );
};
