import React from 'react';
import { Box, Checkbox, Tooltip } from '@material-ui/core';
import PersonIcon from '@material-ui/icons/PersonOutline';
import StarIcon from '@material-ui/icons/StarOutline';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import {
  useEntityList,
  useStarredEntities,
  EntityUserFilter,
} from '@backstage/plugin-catalog-react';
import { usePersonalFilterStyles } from './styles';

export const CustomPersonalFilters: React.FC = () => {
  const classes = usePersonalFilterStyles();
  const { filters, updateFilters, backendEntities } = useEntityList();

  // Get identity API to fetch ownership refs
  const identityApi = useApi(identityApiRef);

  // Get starred entities data
  const { starredEntities } = useStarredEntities();

  // Get ownership entity refs from identity
  const [ownershipRefs, setOwnershipRefs] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Get ownership entity refs from the identity API
    identityApi.getBackstageIdentity().then(identity => {
      if (identity?.ownershipEntityRefs) {
        setOwnershipRefs(identity.ownershipEntityRefs);
      }
    });
  }, [identityApi]);

  // Get current filter state from filters object
  const userFilterValue = (filters.user?.value as string) || '';
  const isOwned = userFilterValue === 'owned';
  const isStarred = userFilterValue === 'starred';

  // Calculate counts by filtering backendEntities
  const ownedCount = React.useMemo(() => {
    if (ownershipRefs.length === 0) return 0;
    const ownedFilter = EntityUserFilter.owned(ownershipRefs);
    return backendEntities.filter(entity => ownedFilter.filterEntity(entity))
      .length;
  }, [backendEntities, ownershipRefs]);

  const starredCount = React.useMemo(() => {
    if (starredEntities.size === 0) return 0;
    const starredRefs = Array.from(starredEntities);
    const starredFilter = EntityUserFilter.starred(starredRefs);
    return backendEntities.filter(entity => starredFilter.filterEntity(entity))
      .length;
  }, [backendEntities, starredEntities]);

  const handleFilterChange = (filterType: 'owned' | 'starred') => {
    if (
      (filterType === 'owned' && isOwned) ||
      (filterType === 'starred' && isStarred)
    ) {
      // Remove the filter
      updateFilters({
        user: undefined,
      });
    } else {
      // Set the new filter using EntityUserFilter
      if (filterType === 'owned') {
        updateFilters({
          user: EntityUserFilter.owned(ownershipRefs),
        });
      } else if (filterType === 'starred') {
        // Convert starred entities Set to array
        const starredRefs = Array.from(starredEntities);
        updateFilters({
          user: EntityUserFilter.starred(starredRefs),
        });
      }
    }
  };

  return (
    <Box className={classes.container}>
      {/* Owned by me filter */}
      <Tooltip title="Entities owned by you">
        <Box
          className={classes.filterItem}
          // onClick={() => handleFilterChange('owned')}
        >
          <Checkbox
            checked={isOwned}
            onChange={() => handleFilterChange('owned')}
            className={classes.checkbox}
            size="small"
            color="primary"
          />
          <Box className={classes.contentContainer}>
            <Box className={classes.labelRow}>
              <PersonIcon className={classes.icon} />
              <span className={classes.label}>Owned by me</span>
            </Box>
          </Box>
          <Box className={classes.countBadge}>{ownedCount}</Box>
        </Box>
      </Tooltip>

      {/* Starred/Favorites filter */}
      <Tooltip title="Your starred entities">
        <Box
          className={classes.filterItem}
          // onClick={() => handleFilterChange('starred')}
          // disabled={starredCount === 0}
        >
          <Checkbox
            checked={isStarred}
            onChange={() => handleFilterChange('starred')}
            className={classes.checkbox}
            size="small"
            color="primary"
            disabled={starredCount === 0}
          />
          <Box className={classes.contentContainer}>
            <Box className={classes.labelRow}>
              <StarIcon className={classes.icon} />
              <span className={classes.label}>Starred</span>
            </Box>
          </Box>
          <Box className={classes.countBadge}>{starredCount}</Box>
        </Box>
      </Tooltip>
    </Box>
  );
};
