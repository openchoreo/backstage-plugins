import { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import RefreshIcon from '@material-ui/icons/Refresh';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import CloudIcon from '@material-ui/icons/Cloud';
import CloudOffIcon from '@material-ui/icons/CloudOff';
import clsx from 'clsx';
import { useEntity } from '@backstage/plugin-catalog-react';
import { parseEntityRef } from '@backstage/catalog-model';
import { Link } from '@backstage/core-components';
import { useNavigate } from 'react-router-dom';
import { Card } from '@openchoreo/backstage-design-system';
import { useDataplaneEnvironments } from './hooks';
import { useDataplaneOverviewStyles } from './styles';
import { shouldNavigateOnRowClick } from '../../utils/shouldNavigateOnRowClick';

const PAGE_SIZE = 5;

export const DataplaneEnvironmentsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const navigate = useNavigate();
  const { environments, loading, error, refresh } =
    useDataplaneEnvironments(entity);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(environments.length / PAGE_SIZE);

  useEffect(() => {
    const maxPage = Math.max(0, totalPages - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [totalPages, page]);

  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginatedEnvs = environments.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  if (loading) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={180} height={28} />
        </Box>
        <div className={classes.environmentList}>
          {[1, 2, 3].map(i => (
            <div key={i} className={classes.environmentItem}>
              <Skeleton variant="text" width="100%" height={40} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Hosted Environments
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2" color="error">
            Failed to load environments
          </Typography>
        </Box>
      </Card>
    );
  }

  if (environments.length === 0) {
    return (
      <Card padding={24} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>
            Hosted Environments
          </Typography>
        </Box>
        <Box className={classes.emptyState}>
          <CloudOffIcon className={classes.emptyIcon} />
          <Typography variant="body2">
            No environments configured on this data plane
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Hosted Environments</Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={refresh}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <div className={classes.environmentList}>
        {paginatedEnvs.map(env => {
          const parsedRef = parseEntityRef(env.entityRef, {
            defaultKind: 'environment',
            defaultNamespace: 'default',
          });
          const envLink = `/catalog/${parsedRef.namespace}/environment/${parsedRef.name}`;
          return (
            <div
              key={env.entityRef}
              className={classes.environmentItem}
              onClick={e => {
                if (shouldNavigateOnRowClick(e)) {
                  navigate(envLink);
                }
              }}
              onKeyDown={e => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(envLink);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Box className={classes.environmentInfo}>
                <CloudIcon style={{ fontSize: '1.2rem', color: 'inherit' }} />
                <Link to={envLink} className={classes.environmentName}>
                  {env.displayName || env.name}
                </Link>
                <Typography
                  className={clsx(
                    classes.environmentType,
                    env.isProduction
                      ? classes.productionBadge
                      : classes.nonProductionBadge,
                  )}
                >
                  {env.isProduction ? 'prod' : 'non-prod'}
                </Typography>
              </Box>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="flex-end"
          mt={1}
        >
          <Typography variant="caption" style={{ marginRight: 8 }}>
            {safePage * PAGE_SIZE + 1}–
            {Math.min((safePage + 1) * PAGE_SIZE, environments.length)} of{' '}
            {environments.length}
          </Typography>
          <IconButton
            size="small"
            disabled={safePage === 0}
            onClick={() => setPage(p => p - 1)}
            aria-label="Previous page"
          >
            <NavigateBeforeIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            aria-label="Next page"
          >
            <NavigateNextIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Card>
  );
};
