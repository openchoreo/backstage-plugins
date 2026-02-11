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
  EntityTagFilter,
} from '@backstage/plugin-catalog-react';
import { useFilterPickerStyles } from './filterPickerStyles';

const MAX_VISIBLE_CHIPS = 1;

export const ScaffolderTagPicker = () => {
  const classes = useFilterPickerStyles();
  const catalogApi = useApi(catalogApiRef);
  const {
    updateFilters,
    filters,
    queryParameters: { tags: tagsParameter },
  } = useEntityList();

  const queryParamTags = useMemo(
    () => [tagsParameter].flat().filter(Boolean) as string[],
    [tagsParameter],
  );

  const filteredTags = filters.tags?.values;
  const [selectedTags, setSelectedTags] = useState<string[]>(
    queryParamTags.length ? queryParamTags : filteredTags ?? [],
  );

  useEffect(() => {
    if (queryParamTags.length) {
      setSelectedTags(queryParamTags);
    }
  }, [queryParamTags]);

  // Fetch available tags via facets, scoped to the current kind filter
  const kindFilter = filters.kind;
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    const fetchTags = async () => {
      const filter: Record<string, string> = {};
      if (kindFilter && 'value' in kindFilter) {
        filter.kind = kindFilter.value as string;
      }
      const { facets } = await catalogApi.getEntityFacets({
        facets: ['metadata.tags'],
        filter: Object.keys(filter).length ? filter : undefined,
      });
      const tags = (facets['metadata.tags'] || []).map(f => f.value);
      setAvailableTags(tags.sort());
    };
    fetchTags();
  }, [catalogApi, kindFilter]);

  // Sync filter state to entity list
  useEffect(() => {
    updateFilters({
      tags:
        selectedTags.length && availableTags.length
          ? new EntityTagFilter(selectedTags)
          : undefined,
    });
  }, [selectedTags, availableTags, updateFilters]);

  // Sync back from external filter changes
  useEffect(() => {
    if (filteredTags && filteredTags.length !== selectedTags.length) {
      setSelectedTags(filteredTags);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTags]);

  if (!availableTags.length) {
    return null;
  }

  const handleDelete = (tagToDelete: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToDelete));
  };

  const overflowCount = selectedTags.length - MAX_VISIBLE_CHIPS;

  return (
    <Box className={classes.root}>
      <Typography
        variant="body2"
        component="label"
        className={classes.label}
      >
        Tags
      </Typography>
      <FormControl
        variant="outlined"
        size="small"
        className={classes.formControl}
      >
        <Select
          id="tag-picker"
          multiple
          displayEmpty
          value={selectedTags}
          onChange={e => setSelectedTags(e.target.value as string[])}
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
          {availableTags.map(tag => (
            <MenuItem key={tag} value={tag} className={classes.menuItem}>
              <Checkbox
                checked={selectedTags.includes(tag)}
                size="small"
                color="primary"
              />
              <ListItemText
                primary={tag}
                primaryTypographyProps={{ style: { fontSize: 14 } }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
