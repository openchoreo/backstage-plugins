import { alertApiRef, useApi, useApp } from '@backstage/core-plugin-api';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListSubheader from '@material-ui/core/ListSubheader';
import Popper, { PopperProps } from '@material-ui/core/Popper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import Autocomplete, {
  AutocompleteRenderGroupParams,
} from '@material-ui/lab/Autocomplete';
import { useEffect, useMemo, useState } from 'react';
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
    autocomplete: {
      minWidth: 180,
    },
    option: {
      display: 'flex',
      alignItems: 'center',
    },
    groupHeader: {
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
    listbox: {
      // Allow the dropdown to expand without early scrolling;
      // only scroll when it approaches viewport height in short windows.
      maxHeight: 'calc(100vh - 170px)',
    },
  }),
);

const UNGROUPED_KIND_CATEGORY = '__ungrouped__';

interface KindOption {
  category: string;
  kind: string;
  label: string;
}

const BottomPinnedPopper = (props: PopperProps) => (
  <Popper
    {...props}
    placement="bottom-start"
    modifiers={{
      flip: {
        enabled: false,
      },
      preventOverflow: {
        boundariesElement: 'window',
        escapeWithReference: true,
      },
    }}
  />
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

  const { loading, error, allKinds, selectedKind, setSelectedKind } =
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

  const kindOptions = useMemo(() => {
    if (error) return [] as KindOption[];

    const options: KindOption[] = [];

    // Keep Namespace as the first, ungrouped option.
    if (availableKinds.has('domain')) {
      options.push({
        category: UNGROUPED_KIND_CATEGORY,
        kind: 'domain',
        label: kindDisplayNames.domain,
      });
    }

    for (const category of kindCategories) {
      if (category.platformOnly && !isPlatformEngineer) continue;

      const visibleKinds = category.kinds.filter(k => availableKinds.has(k));
      if (visibleKinds.length === 0) continue;

      for (const kind of visibleKinds) {
        options.push({
          category: category.label,
          kind,
          label: kindDisplayNames[kind] || kind,
        });
      }
    }

    return options;
  }, [availableKinds, isPlatformEngineer, error]);

  const selectedOption = useMemo(() => {
    const normalizedKind = selectedKind.toLowerCase();
    const matchedOption = kindOptions.find(
      option => option.kind === normalizedKind,
    );

    if (matchedOption) {
      return matchedOption;
    }

    return {
      category: UNGROUPED_KIND_CATEGORY,
      kind: normalizedKind,
      label: kindDisplayNames[normalizedKind] || selectedKind,
    };
  }, [kindOptions, selectedKind]);

  const autocompleteOptions = useMemo(() => {
    const hasSelectedOption = kindOptions.some(
      option => option.kind === selectedOption.kind,
    );

    if (hasSelectedOption) {
      return kindOptions;
    }

    return [selectedOption, ...kindOptions];
  }, [kindOptions, selectedOption]);

  const renderOption = (option: KindOption) => {
    const KindIcon = app.getSystemIcon(`kind:${option.kind}`);

    return (
      <Box className={classes.option}>
        {KindIcon && (
          <ListItemIcon className={classes.listItemIcon}>
            <KindIcon />
          </ListItemIcon>
        )}
        {option.label}
      </Box>
    );
  };

  const renderGroup = (params: AutocompleteRenderGroupParams) => {
    if (params.group === UNGROUPED_KIND_CATEGORY) {
      return <li key={params.key}>{params.children}</li>;
    }

    return (
      <li key={params.key}>
        <ListSubheader className={classes.groupHeader} disableSticky>
          {params.group}
        </ListSubheader>
        {params.children}
      </li>
    );
  };

  if (error) return null;

  return hidden ? null : (
    <Box pb={1} pt={1} className={classes.container}>
      <Typography className={classes.label}>Kind</Typography>
      <Autocomplete<KindOption, false, true, false>
        className={classes.autocomplete}
        options={autocompleteOptions}
        value={selectedOption}
        classes={{ listbox: classes.listbox }}
        PopperComponent={BottomPinnedPopper}
        disableClearable
        openOnFocus
        selectOnFocus
        loading={loading}
        getOptionLabel={option => option.label}
        getOptionSelected={(option, value) => option.kind === value.kind}
        groupBy={option => option.category}
        onChange={(_event, value) => setSelectedKind(value.kind)}
        renderOption={renderOption}
        renderGroup={renderGroup}
        noOptionsText="No entity kinds found"
        fullWidth
        renderInput={params => (
          <TextField
            {...params}
            variant="outlined"
            placeholder="Select kind"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </Box>
  );
};
