import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Checkbox,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
} from '@material-ui/core';
import StarIcon from '@material-ui/icons/StarOutline';
import StarFilledIcon from '@material-ui/icons/Star';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  EntityTypeFilter,
  useEntityList,
  useStarredEntities,
  EntityUserFilter,
} from '@backstage/plugin-catalog-react';
import { usePersonalFilterStyles } from './styles';

export const StarredFilter = () => {
  const classes = usePersonalFilterStyles();
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

  const handleToggle = () => {
    if (isStarred) {
      updateFilters({ user: undefined });
    } else {
      const starredRefs = Array.from(starredEntities);
      updateFilters({ user: EntityUserFilter.starred(starredRefs) });
    }
  };

  return (
    <Box className={classes.container}>
      <Tooltip title="Your starred entities">
        <Box className={classes.filterItem}>
          <Checkbox
            checked={isStarred}
            onChange={handleToggle}
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

export const StarredChip = () => {
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

  const handleToggle = () => {
    if (isStarred) {
      updateFilters({ user: undefined });
    } else {
      const starredRefs = Array.from(starredEntities);
      updateFilters({ user: EntityUserFilter.starred(starredRefs) });
    }
  };

  return (
    <Tooltip title="Filter to starred entities">
      <Chip
        size="small"
        icon={isStarred ? <StarFilledIcon /> : <StarIcon />}
        label={`Starred (${starredCount})`}
        onClick={handleToggle}
        variant={isStarred ? 'default' : 'outlined'}
        color={isStarred ? 'primary' : 'default'}
        disabled={starredCount === 0}
      />
    </Tooltip>
  );
};

export const TypeChip = () => {
  const catalogApi = useApi(catalogApiRef);
  const { filters, updateFilters } = useEntityList();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  const selectedTypes = useMemo(
    () => filters.type?.getTypes() ?? [],
    [filters.type],
  );

  const kind = filters.kind?.value;
  const prevKindRef = useRef(kind);

  useEffect(() => {
    if (prevKindRef.current !== kind) {
      prevKindRef.current = kind;
      updateFilters({ type: undefined });
    }
    if (!kind) {
      setAvailableTypes([]);
      return undefined;
    }
    let cancelled = false;
    catalogApi
      .getEntityFacets({
        filter: { kind },
        facets: ['spec.type'],
      })
      .then(response => {
        if (cancelled) return;
        const types = (response.facets['spec.type'] || []).map(f =>
          f.value.toLocaleLowerCase('en-US'),
        );
        setAvailableTypes([...new Set(types)]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, catalogApi]);

  if (availableTypes.length <= 1) return null;

  const handleToggleType = (type: string) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    updateFilters({
      type: newTypes.length ? new EntityTypeFilter(newTypes) : undefined,
    });
  };

  let label = 'Type';
  if (selectedTypes.length === 1) {
    label = selectedTypes[0];
  } else if (selectedTypes.length > 1) {
    label = `${selectedTypes.length} types`;
  }

  return (
    <>
      <Chip
        size="small"
        label={label}
        deleteIcon={<ArrowDropDownIcon />}
        onDelete={() => {}} // required to show deleteIcon
        onClick={e => setAnchorEl(e.currentTarget)}
        variant={selectedTypes.length > 0 ? 'default' : 'outlined'}
        color={selectedTypes.length > 0 ? 'primary' : 'default'}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {availableTypes.map(type => (
          <MenuItem key={type} dense onClick={() => handleToggleType(type)}>
            <Checkbox
              checked={selectedTypes.includes(type)}
              size="small"
              color="primary"
              style={{ padding: 4, marginRight: 8 }}
            />
            {type}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
