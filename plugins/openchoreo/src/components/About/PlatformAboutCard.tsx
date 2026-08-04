import { Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard, Progress } from '@backstage/core-components';
import { ErrorState } from '@openchoreo/backstage-plugin-react';
import { usePlatformVersion } from '../../hooks/usePlatformVersion';

// Binaries built outside the release pipeline report this literal.
const NOT_SET = 'not-set';

const useStyles = makeStyles(theme => ({
  list: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    columnGap: theme.spacing(4),
    rowGap: theme.spacing(1.5),
    margin: 0,
  },
  label: {
    color: theme.palette.text.secondary,
  },
  value: {
    fontWeight: 500,
    wordBreak: 'break-all',
  },
}));

const displayValue = (value: string | undefined): string =>
  !value || value === NOT_SET ? 'unknown' : value;

const formatBuildTime = (buildTime: string | undefined): string => {
  if (!buildTime || buildTime === NOT_SET) {
    return 'unknown';
  }
  const parsed = new Date(buildTime);
  return isNaN(parsed.getTime()) ? buildTime : parsed.toLocaleString();
};

/**
 * Card showing the deployed OpenChoreo platform version and build details,
 * fetched from the OpenChoreo API server. Composed into the Settings →
 * General tab next to the stock user-settings cards.
 */
export const PlatformAboutCard = () => {
  const classes = useStyles();
  const { version, loading, error } = usePlatformVersion();

  if (loading) {
    return (
      <InfoCard title="OpenChoreo Version" variant="gridItem">
        <Progress />
      </InfoCard>
    );
  }

  if (error) {
    return (
      <InfoCard title="OpenChoreo Version" variant="gridItem">
        <ErrorState
          title="Failed to fetch platform version"
          message={error.message}
        />
      </InfoCard>
    );
  }

  const rows: Array<[string, string]> = [
    ['Version', displayValue(version?.version)],
    ['Git revision', displayValue(version?.gitRevision)],
    ['Build time', formatBuildTime(version?.buildTime)],
    ['API server', displayValue(version?.name)],
    [
      'Platform',
      version?.goOS && version?.goArch
        ? `${version.goOS}/${version.goArch}`
        : 'unknown',
    ],
    ['Go version', displayValue(version?.goVersion)],
  ];

  return (
    <InfoCard title="OpenChoreo Version" variant="gridItem">
      <dl className={classes.list}>
        {rows.map(([label, value]) => (
          <Typography
            key={label}
            component="div"
            variant="body2"
            style={{ display: 'contents' }}
          >
            <dt className={classes.label}>{label}</dt>
            <dd className={classes.value}>{value}</dd>
          </Typography>
        ))}
      </dl>
    </InfoCard>
  );
};
