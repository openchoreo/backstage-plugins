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
import { Entity } from '@backstage/catalog-model';
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

class EntityProjectFilter {
  readonly values: string[];
  constructor(values: string[]) {
    this.values = values;
  }
  getCatalogFilters() {
    return {
      'metadata.annotations.openchoreo.io/project': this.values,
    };
  }
  filterEntity(entity: Entity): boolean {
    const project = entity.metadata.annotations?.['openchoreo.io/project'];
    return project !== undefined && this.values.includes(project);
  }
  toQueryValue() {
    return this.values;
  }
}

export const ProjectChip = () => {
  const catalogApi = useApi(catalogApiRef);
  const { filters, updateFilters } = useEntityList();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const kind = filters.kind?.value;
  const prevKindRef = useRef(kind);

  useEffect(() => {
    if (prevKindRef.current !== kind) {
      prevKindRef.current = kind;
      setSelectedProjects([]);
      updateFilters({ project: undefined } as any);
    }
    const kindLower = kind?.toLowerCase();
    if (kindLower !== 'component' && kindLower !== 'api') {
      setAvailableProjects([]);
      return undefined;
    }
    let cancelled = false;
    catalogApi
      .getEntityFacets({
        filter: { kind: kindLower },
        facets: ['metadata.annotations.openchoreo.io/project'],
      })
      .then(response => {
        if (cancelled) return;
        const projects = (
          response.facets['metadata.annotations.openchoreo.io/project'] || []
        ).map(f => f.value);
        setAvailableProjects([...new Set(projects)].sort());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, catalogApi]);

  if (
    (kind?.toLowerCase() !== 'component' && kind?.toLowerCase() !== 'api') ||
    availableProjects.length <= 1
  ) {
    return null;
  }

  const handleToggleProject = (project: string) => {
    const newProjects = selectedProjects.includes(project)
      ? selectedProjects.filter(p => p !== project)
      : [...selectedProjects, project];
    setSelectedProjects(newProjects);
    updateFilters({
      project: newProjects.length
        ? new EntityProjectFilter(newProjects)
        : undefined,
    } as any);
  };

  let label = 'Project';
  if (selectedProjects.length === 1) {
    label = selectedProjects[0];
  } else if (selectedProjects.length > 1) {
    label = `${selectedProjects.length} projects`;
  }

  return (
    <>
      <Chip
        size="small"
        label={label}
        deleteIcon={<ArrowDropDownIcon />}
        onDelete={() => {}}
        onClick={e => setAnchorEl(e.currentTarget)}
        variant={selectedProjects.length > 0 ? 'default' : 'outlined'}
        color={selectedProjects.length > 0 ? 'primary' : 'default'}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {availableProjects.map(project => (
          <MenuItem
            key={project}
            dense
            onClick={() => handleToggleProject(project)}
          >
            <Checkbox
              checked={selectedProjects.includes(project)}
              size="small"
              color="primary"
              style={{ padding: 4, marginRight: 8 }}
            />
            {project}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

class EntityComponentFilter {
  readonly values: string[];
  constructor(values: string[]) {
    this.values = values;
  }
  getCatalogFilters() {
    return {
      'metadata.annotations.openchoreo.io/component': this.values,
    };
  }
  filterEntity(entity: Entity): boolean {
    const component = entity.metadata.annotations?.['openchoreo.io/component'];
    return component !== undefined && this.values.includes(component);
  }
  toQueryValue() {
    return this.values;
  }
}

export const ComponentChip = () => {
  const catalogApi = useApi(catalogApiRef);
  const { filters, updateFilters } = useEntityList();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);

  const kind = filters.kind?.value;
  const prevKindRef = useRef(kind);

  useEffect(() => {
    if (prevKindRef.current !== kind) {
      prevKindRef.current = kind;
      setSelectedComponents([]);
      updateFilters({ component: undefined } as any);
    }
    if (kind?.toLowerCase() !== 'api') {
      setAvailableComponents([]);
      return undefined;
    }
    let cancelled = false;
    catalogApi
      .getEntityFacets({
        filter: { kind: 'api' },
        facets: ['metadata.annotations.openchoreo.io/component'],
      })
      .then(response => {
        if (cancelled) return;
        const components = (
          response.facets['metadata.annotations.openchoreo.io/component'] || []
        ).map(f => f.value);
        setAvailableComponents([...new Set(components)].sort());
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, catalogApi]);

  if (kind?.toLowerCase() !== 'api' || availableComponents.length <= 1) {
    return null;
  }

  const handleToggleComponent = (component: string) => {
    const newComponents = selectedComponents.includes(component)
      ? selectedComponents.filter(c => c !== component)
      : [...selectedComponents, component];
    setSelectedComponents(newComponents);
    updateFilters({
      component: newComponents.length
        ? new EntityComponentFilter(newComponents)
        : undefined,
    } as any);
  };

  let label = 'Component';
  if (selectedComponents.length === 1) {
    label = selectedComponents[0];
  } else if (selectedComponents.length > 1) {
    label = `${selectedComponents.length} components`;
  }

  return (
    <>
      <Chip
        size="small"
        label={label}
        deleteIcon={<ArrowDropDownIcon />}
        onDelete={() => {}}
        onClick={e => setAnchorEl(e.currentTarget)}
        variant={selectedComponents.length > 0 ? 'default' : 'outlined'}
        color={selectedComponents.length > 0 ? 'primary' : 'default'}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {availableComponents.map(component => (
          <MenuItem
            key={component}
            dense
            onClick={() => handleToggleComponent(component)}
          >
            <Checkbox
              checked={selectedComponents.includes(component)}
              size="small"
              color="primary"
              style={{ padding: 4, marginRight: 8 }}
            />
            {component}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
