import { ChangeEvent, FC } from 'react';
import {
  Box,
  Checkbox,
  Collapse,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@material-ui/core';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import type { PlatformLogFacets } from '../../hooks/usePlatformLogFacets';
import { FacetSelect } from './FacetSelect';
import { usePlatformLogsFilterRowStyles } from './styles';
import { PLATFORM_LOG_LEVELS, PlatformLogsFilters } from './types';

interface PlatformLogsFilterRowProps {
  open: boolean;
  filters: PlatformLogsFilters;
  onFiltersChange: (filters: Partial<PlatformLogsFilters>) => void;
  facets: PlatformLogFacets;
  disabled?: boolean;
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
  facets,
  disabled = false,
}) => {
  const classes = usePlatformLogsFilterRowStyles();
  const [labelsInput, handleLabelsChange] = useDebouncedSearch(
    filters.labels,
    value => onFiltersChange({ labels: value }),
  );

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
          <Grid item xs={12} sm={6} md={3}>
            <FacetSelect
              label="Clusters"
              options={facets.clusterInstances}
              selected={filters.clusterInstances}
              onChange={clusterInstances =>
                onFiltersChange({ clusterInstances })
              }
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FacetSelect
              label="Namespaces"
              options={facets.namespaces}
              selected={filters.namespaces}
              onChange={namespaces => onFiltersChange({ namespaces })}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FacetSelect
              label="Pods"
              options={facets.podNames}
              selected={filters.podNames}
              onChange={podNames => onFiltersChange({ podNames })}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FacetSelect
              label="Containers"
              options={facets.containerNames}
              selected={filters.containerNames}
              onChange={containerNames => onFiltersChange({ containerNames })}
              disabled={disabled}
            />
          </Grid>

          <Grid item xs={12} md={9}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="Labels"
              placeholder="openchoreo.dev/plane=controlplane"
              helperText="Pod label selector. Comma means AND. Clear it to search everything."
              value={labelsInput}
              onChange={handleLabelsChange}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl
              fullWidth
              size="small"
              variant="outlined"
              disabled={disabled}
            >
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
