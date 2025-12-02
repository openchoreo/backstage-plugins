import { Chip, Tooltip } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import type { EnvVar } from '@openchoreo/backstage-plugin-common';
import type { EnvVarStatus } from '../../types/envVarTypes';
import { formatEnvVarValue } from '../../utils/envVarUtils';

export interface EnvVarStatusBadgeProps {
  /** The status of the env var: inherited, overridden, or new */
  status: EnvVarStatus;
  /** Original base value (for 'overridden' status, shown in tooltip) */
  baseValue?: EnvVar;
}

const useStyles = makeStyles((theme: Theme) => ({
  badge: {
    height: 20,
    fontSize: '0.7rem',
    fontWeight: 500,
    marginRight: theme.spacing(1),
  },
  inherited: {
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.grey[700],
  },
  overridden: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.contrastText,
  },
  new: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.contrastText,
  },
}));

const statusConfig: Record<
  EnvVarStatus,
  { label: string; tooltip: string; className: 'inherited' | 'overridden' | 'new' }
> = {
  inherited: {
    label: 'Base',
    tooltip: 'From base workload',
    className: 'inherited',
  },
  overridden: {
    label: 'Override',
    tooltip: 'Overriding base value',
    className: 'overridden',
  },
  new: {
    label: 'New',
    tooltip: 'New environment variable',
    className: 'new',
  },
};

/**
 * A badge component that displays the status of an environment variable
 * in the override context.
 *
 * - Inherited (gray): From base workload, not overridden
 * - Override (blue): Has a base value that is being overridden
 * - New (green): New env var added in override, not in base workload
 *
 * For overridden vars, shows the base value in a tooltip on hover.
 */
export function EnvVarStatusBadge({ status, baseValue }: EnvVarStatusBadgeProps) {
  const classes = useStyles();
  const config = statusConfig[status];

  // Build tooltip text
  let tooltipText = config.tooltip;
  if (status === 'overridden' && baseValue) {
    const baseValueDisplay = formatEnvVarValue(baseValue);
    tooltipText = `Base value: ${baseValueDisplay}`;
  }

  return (
    <Tooltip title={tooltipText} arrow>
      <Chip
        label={config.label}
        size="small"
        className={`${classes.badge} ${classes[config.className]}`}
      />
    </Tooltip>
  );
}
