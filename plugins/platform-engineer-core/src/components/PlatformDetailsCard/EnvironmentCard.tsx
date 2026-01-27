import {
  Box,
  Typography,
  Card,
  Chip,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import AppsIcon from '@material-ui/icons/Apps';
import LaunchIcon from '@material-ui/icons/Launch';
import { Link } from '@backstage/core-components';
import { useStyles } from './styles';

interface Environment {
  namespaceName: string;
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
      key={`${environment.namespaceName}-${environment.name}`}
      className={classes.environmentCard}
      elevation={0}
    >
      {/* Environment Header */}
      <Box className={classes.environmentHeader}>
        <Link
          to={`/catalog/${environment.namespaceName}/environment/${environment.name}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Typography className={classes.environmentName} variant="h5">
            {environment.displayName || environment.name}
          </Typography>
        </Link>
        <Box display="flex" alignItems="center" gridGap={4}>
          <Chip
            label={isProduction ? 'Prod' : 'Non-Prod'}
            className={`${classes.environmentChip} ${
              isProduction ? classes.productionChip : classes.nonProductionChip
            }`}
            size="small"
            variant="outlined"
          />
          <Tooltip title="View Environment Details">
            <IconButton
              size="small"
              component={Link}
              to={`/catalog/${environment.namespaceName}/environment/${environment.name}`}
            >
              <LaunchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Environment Content */}
      <Box className={classes.environmentContent}>
        <Box className={classes.environmentDetail}>
          <Typography className={classes.environmentLabel}>
            DNS Prefix
          </Typography>
          <Typography className={classes.environmentValue} variant="h5">
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
      </Box>
    </Card>
  );
};
