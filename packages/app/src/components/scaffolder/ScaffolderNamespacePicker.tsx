import { useState, useEffect, useMemo } from 'react';
import {
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormControl,
  Chip,
  Box,
  Typography,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  useEntityList,
  EntityNamespaceFilter,
} from '@backstage/plugin-catalog-react';
import { useFilterPickerStyles } from './filterPickerStyles';

const MAX_VISIBLE_CHIPS = 1;

export const ScaffolderNamespacePicker = () => {
  const classes = useFilterPickerStyles();
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
    const fetchNamespaces = async () => {
      const filter: Record<string, string> = {};
      if (kindFilter && 'value' in kindFilter) {
        filter.kind = kindFilter.value as string;
      }
      const { facets } = await catalogApi.getEntityFacets({
        facets: ['metadata.namespace'],
        filter: Object.keys(filter).length ? filter : undefined,
      });
      const namespaces = (facets['metadata.namespace'] || []).map(f => f.value);
      setAvailableNamespaces(namespaces.sort());
    };
    fetchNamespaces();
  }, [catalogApi, kindFilter]);

  useEffect(() => {
    updateFilters({
      namespace:
        selectedNamespaces.length && availableNamespaces.length
          ? new EntityNamespaceFilter(selectedNamespaces)
          : undefined,
    });
  }, [selectedNamespaces, availableNamespaces, updateFilters]);

  // Sync back from external filter changes (e.g. "clear all")
  useEffect(() => {
    if (
      filteredNamespaces &&
      (filteredNamespaces.length !== selectedNamespaces.length ||
        !filteredNamespaces.every((ns, i) => ns === selectedNamespaces[i]))
    ) {
      setSelectedNamespaces(filteredNamespaces);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNamespaces]);

  if (availableNamespaces.length <= 1) {
    return null;
  }

  const handleDelete = (namespaceToDelete: string) => {
    setSelectedNamespaces(prev => prev.filter(n => n !== namespaceToDelete));
  };

  const overflowCount = selectedNamespaces.length - MAX_VISIBLE_CHIPS;

  return (
    <Box className={classes.root}>
      <Typography variant="body2" component="label" className={classes.label}>
        Namespace
      </Typography>
      <FormControl
        variant="outlined"
        size="small"
        className={classes.formControl}
      >
        <Select
          id="namespace-picker"
          multiple
          displayEmpty
          value={selectedNamespaces}
          onChange={e => setSelectedNamespaces(e.target.value as string[])}
          className={classes.select}
          IconComponent={ExpandMoreIcon}
          renderValue={selected => {
            const values = selected as string[];
            if (values.length === 0) {
              return <span className={classes.placeholder}>All</span>;
            }
            return (
              <Box className={classes.chips}>
                {values.slice(0, MAX_VISIBLE_CHIPS).map(value => (
                  <Chip
                    key={value}
                    label={value}
                    size="small"
                    className={classes.chip}
                    onDelete={() => handleDelete(value)}
                    onMouseDown={e => e.stopPropagation()}
                  />
                ))}
                {overflowCount > 0 && (
                  <Chip
                    label={`+${overflowCount}`}
                    size="small"
                    className={classes.overflowChip}
                    onMouseDown={e => e.stopPropagation()}
                  />
                )}
              </Box>
            );
          }}
          MenuProps={{
            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: { vertical: 'top', horizontal: 'left' },
            getContentAnchorEl: null,
            PaperProps: {
              style: { maxHeight: 300 },
            },
          }}
        >
          {availableNamespaces.map(namespace => (
            <MenuItem
              key={namespace}
              value={namespace}
              className={classes.menuItem}
            >
              <Checkbox
                checked={selectedNamespaces.includes(namespace)}
                size="small"
                color="primary"
              />
              <ListItemText
                primary={namespace}
                primaryTypographyProps={{ style: { fontSize: 14 } }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
