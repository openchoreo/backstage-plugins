import { useMemo } from 'react';
import { Box, Chip, Tooltip, Typography } from '@material-ui/core';
import { alpha, makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
    fontSize: 12,
    minWidth: 0,
  },
  label: {
    flexShrink: 0,
  },
  chip: {
    height: 20,
    fontSize: 11,
    maxWidth: '100%',
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
    color: theme.palette.primary.main,
    fontWeight: 500,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
  },
  moreChip: {
    height: 20,
    fontSize: 11,
    borderColor: theme.palette.divider,
    color: theme.palette.text.secondary,
  },
  tooltipList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
}));

export interface DeployedEnvBadgesProps {
  /** Envs this release is currently bound to (original casing preserved). */
  envs: string[];
  /**
   * When set and matches an env in `envs` (case-insensitive), render that env
   * as the primary chip. Falls back to the first env otherwise.
   */
  primaryEnv?: string;
}

/**
 * Compact "Deployed to: [<primary>] [+N more ▾]" row used by the release
 * picker and browser. The overflow chip's tooltip lists every hidden env so
 * nothing is lost when a release is bound to many environments.
 */
export const DeployedEnvBadges = ({
  envs,
  primaryEnv,
}: DeployedEnvBadgesProps) => {
  const classes = useStyles();

  const { primary, hidden } = useMemo(() => {
    if (envs.length === 0) return { primary: null, hidden: [] as string[] };
    const target = primaryEnv?.toLowerCase();
    const primaryIndex = target
      ? envs.findIndex(e => e.toLowerCase() === target)
      : -1;
    const idx = primaryIndex >= 0 ? primaryIndex : 0;
    return {
      primary: envs[idx],
      hidden: envs.filter((_, i) => i !== idx),
    };
  }, [envs, primaryEnv]);

  if (!primary) return null;

  return (
    <Box className={classes.row}>
      <Typography
        variant="caption"
        color="textSecondary"
        className={classes.label}
      >
        Deployed to:
      </Typography>
      <Chip label={primary} size="small" className={classes.chip} />
      {hidden.length > 0 && (
        <Tooltip
          title={
            <Box className={classes.tooltipList}>
              {hidden.map(env => (
                <Typography key={env} variant="caption" display="block">
                  {env}
                </Typography>
              ))}
            </Box>
          }
        >
          <Chip
            label={`+${hidden.length} more`}
            size="small"
            variant="outlined"
            className={classes.moreChip}
          />
        </Tooltip>
      )}
    </Box>
  );
};
