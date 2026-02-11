import { useMemo } from 'react';
import { Box, Checkbox, Tooltip } from '@material-ui/core';
import StarIcon from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import {
  useEntityList,
  useStarredEntities,
  EntityUserFilter,
} from '@backstage/plugin-catalog-react';

const useStarredFilterStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    maxWidth: theme.spacing(32),
  },
  filterItem: {
    height: 44,
    boxSizing: 'border-box',
    padding: theme.spacing(0, 2),
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.grey[200]}`,
    borderRadius: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    cursor: 'pointer',
    transition: 'border-color 0.2s ease-in-out',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  checkbox: {
    padding: 0,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  icon: {
    fontSize: '1.1rem',
    color: theme.palette.primary.main,
  },
  label: {
    color: theme.palette.text.primary,
    margin: 0,
    fontSize: '0.85rem',
  },
  countBadge: {
    padding: theme.spacing(0.25, 0.6),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textAlign: 'center',
    minWidth: theme.spacing(2.5),
  },
}));

export const ScaffolderStarredFilter = () => {
  const classes = useStarredFilterStyles();
  const { filters, updateFilters, backendEntities } = useEntityList();
  const { starredEntities } = useStarredEntities();

  const userFilterValue = (filters.user?.value as string) || '';
  const isStarred = userFilterValue === 'starred';

  const starredCount = useMemo(() => {
    if (starredEntities.size === 0) return 0;
    const starredRefs = Array.from(starredEntities);
    const starredFilter = EntityUserFilter.starred(starredRefs);
    return backendEntities.filter(entity => starredFilter.filterEntity(entity))
      .length;
  }, [backendEntities, starredEntities]);

  const handleFilterChange = () => {
    if (isStarred) {
      updateFilters({ user: undefined });
    } else {
      const starredRefs = Array.from(starredEntities);
      updateFilters({ user: EntityUserFilter.starred(starredRefs) });
    }
  };

  return (
    <Box className={classes.container}>
      <Tooltip title="Your starred templates">
        <Box className={classes.filterItem}>
          <Checkbox
            checked={isStarred}
            onChange={handleFilterChange}
            className={classes.checkbox}
            size="small"
            color="primary"
            disabled={starredCount === 0}
          />
          <Box className={classes.labelRow}>
            <StarIcon className={classes.icon} />
            <span className={classes.label}>Starred</span>
          </Box>
          <Box className={classes.countBadge}>{starredCount}</Box>
        </Box>
      </Tooltip>
    </Box>
  );
};
