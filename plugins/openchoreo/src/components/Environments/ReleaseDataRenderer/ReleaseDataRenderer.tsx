import type { FC } from 'react';
import { Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { ReleaseData } from './types';
import { OverviewSection } from './OverviewSection';
import { ResourcesSection } from './ResourcesSection';
import { ConditionsSection } from './ConditionsSection';
import { ResourceDefinitionsSection } from './ResourceDefinitionsSection';

interface ReleaseDataRendererProps {
  releaseData: ReleaseData;
}

export const ReleaseDataRenderer: FC<ReleaseDataRendererProps> = ({
  releaseData,
}) => {
  const classes = useStyles();
  const data = releaseData?.data;

  if (!data || (!data.spec && !data.status)) {
    return (
      <Typography className={classes.emptyValue}>
        No release data available
      </Typography>
    );
  }

  const hasResources =
    data.status?.resources && data.status.resources.length > 0;
  const hasConditions =
    data.status?.conditions && data.status.conditions.length > 0;
  const hasSpecResources =
    data.spec?.resources && data.spec.resources.length > 0;

  return (
    <Box>
      {data.spec && <OverviewSection spec={data.spec} classes={classes} />}

      {hasResources && (
        <ResourcesSection
          resources={data.status!.resources!}
          classes={classes}
        />
      )}

      {hasConditions && (
        <ConditionsSection
          conditions={data.status!.conditions!}
          classes={classes}
        />
      )}

      {hasSpecResources && (
        <ResourceDefinitionsSection
          resources={data.spec!.resources!}
          classes={classes}
        />
      )}
    </Box>
  );
};
