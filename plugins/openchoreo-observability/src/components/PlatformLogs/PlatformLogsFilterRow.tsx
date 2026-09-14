import { ChangeEvent, FC, useMemo, useState } from 'react';
import {
  Box,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@material-ui/core';
import ClearIcon from '@material-ui/icons/Clear';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { PlatformLogFacets } from '../../hooks/usePlatformLogFacets';
import { usePlatformLogFilterValues } from '../../hooks/usePlatformLogFilterValues';
import { FacetSelect } from './FacetSelect';
import { usePlatformLogsFilterRowStyles } from './styles';
import {
  PLATFORM_LOG_FACETS,
  PLATFORM_LOG_LEVELS,
  PlatformLogFilterName,
  PlatformLogsFilters,
} from './types';
import { validateLabelSelector } from './validation';

/** How long typing settles before the values are asked for again. */
const VALUE_SEARCH_DEBOUNCE_MS = 300;

interface PlatformLogsFilterRowProps {
  open: boolean;
  filters: PlatformLogsFilters;
  onFiltersChange: (filters: Partial<PlatformLogsFilters>) => void;
  /**
   * Values derived from the loaded rows, used for whichever pickers the observer has
   * not answered for - it is asked one filter at a time, and older planes cannot answer
   * at all.
   */
  fallbackFacets: PlatformLogFacets;
  /** The plane's Observer API, if it publishes one. */
  observerUrl?: string;
}

/**
 * The controls that narrow the result set, folded away by default.
 *
 * Kept mounted while collapsed so the debounced label input does not lose a value the
 * user has typed but not yet committed when the row is toggled shut.
 */
export const PlatformLogsFilterRow: FC<PlatformLogsFilterRowProps> = ({
  open,
  filters,
  onFiltersChange,
  fallbackFacets,
  observerUrl,
}) => {
  const classes = usePlatformLogsFilterRowStyles();

  // Which picker is open, and what has been typed into it. Held here rather than in
  // each picker because the values are fetched one filter at a time: the open one is
  // the one worth asking about, and opening a second must not leave the first fetching.
  const [openFilter, setOpenFilter] = useState<PlatformLogFilterName | null>(
    null,
  );
  const [valueSearch, setValueSearch] = useState('');

  const debouncedValueSearch = useDebouncedValue(
    valueSearch,
    VALUE_SEARCH_DEBOUNCE_MS,
  );

  const { values, loading: valuesLoading } = usePlatformLogFilterValues(
    observerUrl,
    openFilter,
    filters,
    debouncedValueSearch,
  );

  const openPicker = (filter: PlatformLogFilterName, isOpen: boolean) => {
    setOpenFilter(isOpen ? filter : null);
    // Text typed into one picker must not narrow the next one, where it would silently
    // hide values with nothing on screen to explain why.
    setValueSearch('');
  };

  // The observer answers with the values carrying the most records, which can leave out
  // one that is already applied - capped out, or logged outside the window. A picker
  // renders no row for a value it was not given, so an applied value absent from the
  // answer could never be unticked. They go first: being able to remove them is the
  // only reason they are listed, and below a hundred counted values they are lost.
  const offered = useMemo(() => {
    if (!openFilter || !values) return null;

    const facet = PLATFORM_LOG_FACETS.find(f => f.filter === openFilter)!;
    const applied = filters[facet.key] as string[];
    const answered = new Set(values.map(v => v.value));
    const missing = applied
      .filter(value => !answered.has(value))
      .sort((a, b) => a.localeCompare(b));

    return {
      options: [...missing, ...values.map(v => v.value)],
      counts: Object.fromEntries(values.map(v => [v.value, v.count])),
    };
  }, [openFilter, values, filters]);
  const [labelsInput, handleLabelsChange, clearLabels] = useDebouncedSearch(
    filters.labels,
    // Only applied once it parses. Every intermediate state of a selector is invalid, so
    // firing on the debounce alone meant pausing mid-pair produced a rejected query.
    value => {
      if (!validateLabelSelector(value)) onFiltersChange({ labels: value });
    },
  );

  // Validated against what is typed, not what is applied, so the reason shows up as soon
  // as the field is wrong rather than after the debounce.
  const labelsError = validateLabelSelector(labelsInput);

  const allLevels = filters.logLevel.length === PLATFORM_LOG_LEVELS.length;

  const handleLogLevelChange = (event: ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string[];
    // 'ALL' present means the All item was clicked; its own handler already ran.
    if (value.includes('ALL')) return;
    onFiltersChange({ logLevel: value });
  };

  return (
    <Collapse in={open} timeout="auto">
      <Box className={classes.root} id="platform-logs-filter-row">
        <Grid container spacing={2}>
          {PLATFORM_LOG_FACETS.map(({ filter, key, label }) => {
            const isOpen = openFilter === filter;
            const shown = isOpen && offered ? offered : null;
            return (
              <Grid item xs={12} sm={6} md={3} key={filter}>
                <FacetSelect
                  label={label}
                  options={shown ? shown.options : fallbackFacets[key]}
                  counts={shown?.counts}
                  selected={filters[key] as string[]}
                  onChange={selected => onFiltersChange({ [key]: selected })}
                  open={isOpen}
                  onOpenChange={isNowOpen => openPicker(filter, isNowOpen)}
                  onSearchChange={setValueSearch}
                  loading={isOpen && valuesLoading}
                />
              </Grid>
            );
          })}

          <Grid item xs={12} md={9}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              id="platform-logs-labels"
              label="Labels"
              placeholder="openchoreo.dev/plane=controlplane"
              error={Boolean(labelsError)}
              helperText={
                labelsError ??
                'Pod label selector. Comma means AND. Clear it to search everything.'
              }
              value={labelsInput}
              onChange={handleLabelsChange}
              InputProps={{
                endAdornment: labelsInput ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label="Clear labels"
                      onClick={clearLabels}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel id="platform-logs-levels">Log Levels</InputLabel>
              <Select
                multiple
                labelId="platform-logs-levels"
                label="Log Levels"
                value={filters.logLevel}
                onChange={handleLogLevelChange}
                renderValue={selected => {
                  const levels = selected as string[];
                  if (levels.length === 0) return 'None';
                  if (levels.length === PLATFORM_LOG_LEVELS.length)
                    return 'All';
                  return levels.join(', ');
                }}
              >
                <MenuItem
                  value="ALL"
                  onMouseDown={() =>
                    onFiltersChange({
                      logLevel: allLevels ? [] : [...PLATFORM_LOG_LEVELS],
                    })
                  }
                >
                  <Checkbox
                    checked={allLevels}
                    indeterminate={!allLevels && filters.logLevel.length > 0}
                  />
                  All
                </MenuItem>
                <Divider />
                {PLATFORM_LOG_LEVELS.map(level => (
                  <MenuItem key={level} value={level}>
                    <Checkbox checked={filters.logLevel.includes(level)} />
                    {level}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Box>
    </Collapse>
  );
};
