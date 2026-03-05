import { alertApiRef, useApi, useApp } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListSubheader from '@material-ui/core/ListSubheader';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Typography from '@material-ui/core/Typography';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  EntityKindFilter,
  useEntityList,
  catalogApiRef,
} from '@backstage/plugin-catalog-react';
import { useUserGroups } from '../../hooks';

// Mapping of internal kind names to OpenChoreo display names
const kindDisplayNames: Record<string, string> = {
  domain: 'Namespace',
  system: 'Project',
  component: 'Component',
  api: 'API',
  user: 'User',
  group: 'Group',
  resource: 'Resource',
  location: 'Location',
  template: 'Template',
  dataplane: 'Dataplane',
  clusterdataplane: 'Cluster Data Plane',
  buildplane: 'Build Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  clusterbuildplane: 'Cluster Build Plane',
  environment: 'Environment',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  clustercomponenttype: 'Cluster Component Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  componentworkflow: 'Component Workflow',
};

interface KindCategory {
  label: string;
  platformOnly?: boolean;
  kinds: string[];
}

const kindCategories: KindCategory[] = [
  {
    label: 'Developer Resources',
    kinds: ['system', 'component', 'api', 'resource'],
  },
  {
    label: 'Platform Resources',
    platformOnly: true,
    kinds: [
      'dataplane',
      'clusterdataplane',
      'buildplane',
      'clusterbuildplane',
      'observabilityplane',
      'clusterobservabilityplane',
      'environment',
      'deploymentpipeline',
    ],
  },
  {
    label: 'Platform Configuration',
    platformOnly: true,
    kinds: [
      'clustercomponenttype',
      'componenttype',
      'clustertraittype',
      'traittype',
      'workflow',
      'componentworkflow',
    ],
  },
  {
    label: 'Backstage',
    kinds: ['user', 'group', 'location', 'template'],
  },
];

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    label: {
      fontWeight: 'bold',
      fontSize: theme.typography.body2.fontSize,
      fontFamily: theme.typography.fontFamily,
      color: theme.palette.text.primary,
      whiteSpace: 'nowrap',
    },
    select: {
      minWidth: 180,
    },
    renderValue: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      '& svg': {
        fontSize: '1.2rem',
        color: theme.palette.text.secondary,
      },
    },
    subheader: {
      color: theme.palette.text.secondary,
      fontSize: theme.typography.caption.fontSize,
      fontWeight: theme.typography.fontWeightBold as number,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      lineHeight: '32px',
      pointerEvents: 'none',
    },
    listItemIcon: {
      minWidth: 32,
      color: theme.palette.text.secondary,
      '& svg': {
        fontSize: '1.2rem',
      },
    },
  }),
);

// Hook to fetch all available Choreo entity kinds from the catalog
function useAllKinds(): {
  allKinds: Map<string, string>;
  loading: boolean;
  error?: Error;
} {
  const catalogApi = useApi(catalogApiRef);
  const [allKinds, setAllKinds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let isMounted = true;

    const fetchKinds = async () => {
      try {
        setLoading(true);
        // Fetch all entities to get available kinds
        const { items } = await catalogApi.getEntities({
          fields: ['kind'],
        });

        if (!isMounted) return;

        // Extract unique kinds
        const kindsSet = new Set<string>();
        items.forEach(entity => {
          if (entity.kind) {
            kindsSet.add(entity.kind);
          }
        });

        // Create map with kinds as both key and value (we'll override the value with custom label later)
        const kindsMap = new Map<string, string>();
        kindsSet.forEach(kind => {
          kindsMap.set(kind, kind);
        });

        setAllKinds(kindsMap);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(err as Error);
        setLoading(false);
      }
    };

    fetchKinds();

    return () => {
      isMounted = false;
    };
  }, [catalogApi]);

  return { allKinds, loading, error };
}

function useEntityKindFilter(opts: { initialFilter: string }): {
  loading: boolean;
  error?: Error;
  allKinds: Map<string, string>;
  selectedKind: string;
  setSelectedKind: (kind: string) => void;
} {
  const {
    filters,
    queryParameters: { kind: kindParameter },
    updateFilters,
  } = useEntityList();

  const queryParamKind = useMemo(
    () => [kindParameter].flat()[0],
    [kindParameter],
  );

  const [selectedKind, setSelectedKind] = useState(
    queryParamKind ?? filters.kind?.value ?? opts.initialFilter,
  );

  // Set selected kinds on query parameter updates
  useEffect(() => {
    if (queryParamKind) {
      setSelectedKind(queryParamKind);
    }
  }, [queryParamKind]);

  // Set selected kind from filters
  useEffect(() => {
    if (filters.kind?.value) {
      setSelectedKind(filters.kind?.value);
    }
  }, [filters.kind]);

  const { allKinds, loading, error } = useAllKinds();

  // Override the label with our custom display name
  const selectedKindLabel =
    kindDisplayNames[selectedKind.toLowerCase()] ||
    allKinds.get(selectedKind) ||
    selectedKind;

  useEffect(() => {
    updateFilters({
      kind: selectedKind
        ? new EntityKindFilter(selectedKind, selectedKindLabel)
        : undefined,
    });
  }, [selectedKind, selectedKindLabel, updateFilters]);

  return {
    loading,
    error,
    allKinds,
    selectedKind,
    setSelectedKind,
  };
}

/**
 * Custom EntityKindPicker that displays OpenChoreo names for entity kinds
 * Maps: Domain -> Namespace, System -> Project
 */
export interface ChoreoEntityKindPickerProps {
  allowedKinds?: string[];
  initialFilter?: string;
  hidden?: boolean;
}

export const ChoreoEntityKindPicker = (props: ChoreoEntityKindPickerProps) => {
  const { allowedKinds, hidden, initialFilter = 'component' } = props;
  const classes = useStyles();
  const app = useApp();

  const alertApi = useApi(alertApiRef);

  const { error, allKinds, selectedKind, setSelectedKind } =
    useEntityKindFilter({
      initialFilter: initialFilter,
    });

  // Get user groups to check if user is a platform engineer
  const { userGroups } = useUserGroups();
  const isPlatformEngineer = userGroups.includes('platformengineer');

  useEffect(() => {
    if (error) {
      alertApi.post({
        message: 'Failed to load entity kinds',
        severity: 'error',
      });
    }
  }, [error, alertApi]);

  // Build a set of available kind keys (lowercased) for filtering
  const availableKinds = useMemo(() => {
    const available = new Set<string>();
    allKinds.forEach((_value, key) => {
      const lowerKey = key.toLowerCase();
      if (
        !allowedKinds ||
        allowedKinds.some(a => a.toLowerCase() === lowerKey)
      ) {
        available.add(lowerKey);
      }
    });
    return available;
  }, [allKinds, allowedKinds]);

  // Build grouped menu items
  const menuItems = useMemo(() => {
    if (error) return [];

    const items: ReactNode[] = [];

    // Add Namespace (domain) as a standalone top-level item
    if (availableKinds.has('domain')) {
      const DomainIcon = app.getSystemIcon('kind:domain');
      items.push(
        <MenuItem key="domain" value="domain">
          {DomainIcon && (
            <ListItemIcon className={classes.listItemIcon}>
              <DomainIcon />
            </ListItemIcon>
          )}
          {kindDisplayNames.domain}
        </MenuItem>,
      );
    }

    for (const category of kindCategories) {
      // Skip platform-only categories for non-platform engineers
      if (category.platformOnly && !isPlatformEngineer) continue;

      // Filter to only kinds that exist in the catalog
      const visibleKinds = category.kinds.filter(k => availableKinds.has(k));

      // Skip category if no kinds are available
      if (visibleKinds.length === 0) continue;

      items.push(
        <ListSubheader
          key={`header-${category.label}`}
          className={classes.subheader}
          disableSticky
        >
          {category.label}
        </ListSubheader>,
      );

      for (const kind of visibleKinds) {
        const KindIcon = app.getSystemIcon(`kind:${kind}`);
        items.push(
          <MenuItem key={kind} value={kind}>
            {KindIcon && (
              <ListItemIcon className={classes.listItemIcon}>
                <KindIcon />
              </ListItemIcon>
            )}
            {kindDisplayNames[kind] || kind}
          </MenuItem>,
        );
      }
    }

    return items;
  }, [availableKinds, isPlatformEngineer, error, classes, app]);

  if (error) return null;

  return hidden ? null : (
    <Box pb={1} pt={1} className={classes.container}>
      <Typography className={classes.label}>Kind</Typography>
      <Select
        className={classes.select}
        value={selectedKind.toLowerCase()}
        onChange={e => setSelectedKind(e.target.value as string)}
        variant="outlined"
        fullWidth
        renderValue={value => {
          const kind = value as string;
          const KindIcon = app.getSystemIcon(`kind:${kind}`);
          return (
            <Box className={classes.renderValue}>
              {KindIcon && <KindIcon />}
              {kindDisplayNames[kind] || kind}
            </Box>
          );
        }}
        MenuProps={{
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          getContentAnchorEl: null,
        }}
      >
        {menuItems}
      </Select>
    </Box>
  );
};
