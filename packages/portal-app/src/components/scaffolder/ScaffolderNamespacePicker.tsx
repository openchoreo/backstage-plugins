import { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, makeStyles } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  useEntityList,
  EntityNamespaceFilter,
} from '@backstage/plugin-catalog-react';
import { NamespaceScopeFilter } from '@openchoreo/backstage-plugin-react';

const useStyles = makeStyles(theme => ({
  label: {
    fontWeight: 'bold',
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
    display: 'block',
  },
  trigger: {
    height: 44,
    fontSize: 14,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(0, 1.75),
  },
}));

export const ScaffolderNamespacePicker = () => {
  const classes = useStyles();
  const catalogApi = useApi(catalogApiRef);
  const {
    updateFilters,
    filters,
    queryParameters: { namespace: namespaceParameter },
  } = useEntityList();

  const queryParamNamespaces = useMemo(
    () => [namespaceParameter].flat().filter(Boolean) as string[],
    [namespaceParameter],
  );

  const filteredNamespaces = filters.namespace?.values;
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>(
    queryParamNamespaces.length
      ? queryParamNamespaces
      : filteredNamespaces ?? [],
  );

  useEffect(() => {
    if (queryParamNamespaces.length) {
      setSelectedNamespaces(queryParamNamespaces);
    }
  }, [queryParamNamespaces]);

  const kindFilter = filters.kind;
  const [availableNamespaces, setAvailableNamespaces] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchNamespaces = async () => {
      try {
        const filter: Record<string, string> = {};
        if (kindFilter && 'value' in kindFilter) {
          filter.kind = kindFilter.value as string;
        }
        const { facets } = await catalogApi.getEntityFacets({
          facets: ['metadata.namespace'],
          filter: Object.keys(filter).length ? filter : undefined,
        });
        if (cancelled) return;
        const namespaces = (facets['metadata.namespace'] || []).map(
          f => f.value,
        );
        setAvailableNamespaces(namespaces.sort());
      } catch (err) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch namespaces', err);
        }
      }
    };
    fetchNamespaces();
    return () => {
      cancelled = true;
    };
  }, [catalogApi, kindFilter]);

  // Seed the initial selection to "all available namespaces" once they're
  // known, so templates published to non-default namespaces stay discoverable.
  // Skipped if the user already has an active selection from query params,
  // an external filter, or a prior choice.
  const defaultSeedAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultSeedAppliedRef.current) return;
    if (availableNamespaces.length === 0) return;
    if (selectedNamespaces.length > 0) {
      defaultSeedAppliedRef.current = true;
      return;
    }
    if (queryParamNamespaces.length > 0) return;
    if (filteredNamespaces && filteredNamespaces.length > 0) return;

    defaultSeedAppliedRef.current = true;
    setSelectedNamespaces(availableNamespaces);
  }, [
    availableNamespaces,
    selectedNamespaces,
    queryParamNamespaces,
    filteredNamespaces,
  ]);

  useEffect(() => {
    updateFilters({
      namespace: selectedNamespaces.length
        ? new EntityNamespaceFilter(selectedNamespaces)
        : undefined,
    });
  }, [selectedNamespaces, updateFilters]);

  // Track whether the namespace filter has ever been applied so we can
  // distinguish "never set yet" (initial mount) from "explicitly cleared".
  const filterWasSetRef = useRef(false);

  // Sync back from external filter changes (e.g. "clear all")
  useEffect(() => {
    if (filteredNamespaces) {
      filterWasSetRef.current = true;
      if (
        filteredNamespaces.length !== selectedNamespaces.length ||
        !filteredNamespaces.every((ns, i) => ns === selectedNamespaces[i])
      ) {
        setSelectedNamespaces(filteredNamespaces);
      }
    } else if (filterWasSetRef.current) {
      filterWasSetRef.current = false;
      setSelectedNamespaces([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNamespaces]);

  if (availableNamespaces.length <= 1) {
    return null;
  }

  return (
    <Box>
      <Typography variant="body2" component="label" className={classes.label}>
        Scope
      </Typography>
      <NamespaceScopeFilter
        label="Scope"
        availableNamespaces={availableNamespaces}
        selected={selectedNamespaces}
        onChange={setSelectedNamespaces}
        emptyLabel="All"
        fullWidth
        hideLabelInTrigger
        triggerClassName={classes.trigger}
      />
    </Box>
  );
};
