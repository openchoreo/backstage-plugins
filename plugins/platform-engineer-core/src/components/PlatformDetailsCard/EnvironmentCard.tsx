import { Box, Typography, Card, Chip } from '@material-ui/core';
import AppsIcon from '@material-ui/icons/Apps';
import { useStyles } from './styles';
import { StatusBadge } from '@openchoreo/backstage-design-system';

interface Environment {
  organization: string;
  name: string;
  displayName?: string;
  isProduction: boolean;
  dnsPrefix: string;
  componentCount?: number;
  status: string;
}

interface EnvironmentCardProps {
  environment: Environment;
}

export const EnvironmentCard = ({ environment }: EnvironmentCardProps) => {
  const classes = useStyles();
  const isProduction = environment.isProduction;

  return (
    <Card
      key={`${environment.organization}-${environment.name}`}
      className={classes.environmentCard}
      elevation={0}
    >
      {/* Environment Header */}
      <Box className={classes.environmentHeader}>
        <Typography className={classes.environmentName}>
          {environment.displayName || environment.name}
        </Typography>
        <Chip
          label={isProduction ? 'Prod' : 'Non-Prod'}
          className={`${classes.environmentChip} ${
            isProduction ? classes.productionChip : classes.nonProductionChip
          }`}
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Environment Content */}
      <Box className={classes.environmentContent}>
        <Box className={classes.environmentDetail}>
          <Typography className={classes.environmentLabel}>
            DNS Prefix
          </Typography>
          <Typography className={classes.environmentValue}>
            {environment.dnsPrefix}
          </Typography>
        </Box>

        <Box className={classes.environmentDetail}>
          <Typography className={classes.environmentLabel}>
            Components
          </Typography>
          <Box className={classes.componentCount}>
            <AppsIcon className={classes.componentCountIcon} />
            {environment.componentCount ?? 0}
          </Box>
        </Box>

        <Box className={classes.environmentDetail}>
          <Typography className={classes.environmentLabel}>Status</Typography>
          <StatusBadge status="unknown" label={environment.status} />
        </Box>
      </Box>
    </Card>
  );
};
