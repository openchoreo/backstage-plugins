import { FC, ChangeEvent } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Divider,
  Grid,
  TextField,
} from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { TimeRangeFilter } from '@openchoreo/backstage-plugin-react';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import type { ObservabilityPlaneOption } from '../../hooks/useObservabilityPlanes';
import {
  PLATFORM_LOG_LEVELS,
  PlatformLogField,
  PlatformLogsFilters,
} from './types';

interface PlatformLogsFilterProps {
  filters: PlatformLogsFilters;
  onFiltersChange: (filters: Partial<PlatformLogsFilters>) => void;
  planes: ObservabilityPlaneOption[];
  planesLoading: boolean;
  disabled?: boolean;
}

/** Turns `a, b , ,c` into `['a','b','c']` so the free-text lists tolerate spacing. */
const parseCsv = (value: string): string[] =>
  value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

export const PlatformLogsFilter: FC<PlatformLogsFilterProps> = ({
  filters,
  onFiltersChange,
  planes,
  planesLoading,
  disabled = false,
}) => {
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
  );
  const [labelsInput, handleLabelsChange] = useDebouncedSearch(
    filters.labels,
    value => onFiltersChange({ labels: value }),
  );

  // v1 has no facet endpoint, so cluster / namespace / pod / container are free text
  // rather than pickers populated from the data. Comma-separated, matching the API.
  const [namespacesInput, handleNamespacesChange] = useDebouncedSearch(
    filters.namespaces.join(','),
    value => onFiltersChange({ namespaces: parseCsv(value) }),
  );
  const [podsInput, handlePodsChange] = useDebouncedSearch(
    filters.podNames.join(','),
    value => onFiltersChange({ podNames: parseCsv(value) }),
  );
  const [clustersInput, handleClustersChange] = useDebouncedSearch(
    filters.clusterInstances.join(','),
    value => onFiltersChange({ clusterInstances: parseCsv(value) }),
  );

  const handleLogLevelChange = (event: ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string[];
    // 'ALL' means the All item was clicked — already handled by its onMouseDown.
    if (value.includes('ALL')) return;
    onFiltersChange({ logLevel: value });
  };

  const handleAllLogLevelsToggle = () => {
    onFiltersChange({
      logLevel:
        filters.logLevel.length === PLATFORM_LOG_LEVELS.length
          ? []
          : [...PLATFORM_LOG_LEVELS],
    });
  };

  const handleFieldsChange = (event: ChangeEvent<{ value: unknown }>) => {
    let selectedFields = event.target.value as PlatformLogField[];
    if (!selectedFields.includes(PlatformLogField.Log)) {
      selectedFields = [...selectedFields, PlatformLogField.Log];
    }
    onFiltersChange({
      selectedFields: Object.values(PlatformLogField).filter(field =>
        selectedFields.includes(field),
      ),
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <FormControl
          fullWidth
          disabled={disabled || planesLoading}
          variant="outlined"
        >
          <InputLabel id="plane-label">Observability Plane</InputLabel>
          {planesLoading ? (
            <Skeleton variant="rect" height={56} />
          ) : (
            <Select
              value={filters.observabilityPlane}
              onChange={event =>
                onFiltersChange({
                  observabilityPlane: event.target.value as string,
                })
              }
              labelId="plane-label"
              label="Observability Plane"
            >
              {planes.map(plane => (
                <MenuItem key={plane.name} value={plane.name}>
                  {plane.displayName}
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>
      </Grid>

      <Grid item xs={12} md={5}>
        <TextField
          fullWidth
          label="Labels"
          placeholder="openchoreo.dev/plane=controlplane"
          helperText="Pod label selector. Comma means AND. Clear it to search everything."
          variant="outlined"
          value={labelsInput}
          onChange={handleLabelsChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Search"
          placeholder="Search log messages..."
          variant="outlined"
          value={searchInput}
          onChange={handleSearchChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={2}>
        <TextField
          fullWidth
          label="Clusters"
          placeholder="cluster1, cluster2"
          variant="outlined"
          value={clustersInput}
          onChange={handleClustersChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={2}>
        <TextField
          fullWidth
          label="Namespaces"
          placeholder="openchoreo-control-plane"
          variant="outlined"
          value={namespacesInput}
          onChange={handleNamespacesChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={2}>
        <TextField
          fullWidth
          label="Pods"
          placeholder="controller-manager-..."
          variant="outlined"
          value={podsInput}
          onChange={handlePodsChange}
          disabled={disabled}
        />
      </Grid>

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="platform-log-levels-label">Log Levels</InputLabel>
          <Select
            multiple
            value={filters.logLevel}
            onChange={handleLogLevelChange}
            labelId="platform-log-levels-label"
            label="Log Levels"
            renderValue={selected => {
              const levels = selected as string[];
              if (levels.length === 0) return 'None';
              if (levels.length === PLATFORM_LOG_LEVELS.length) return 'All';
              return levels.join(', ');
            }}
          >
            <MenuItem value="ALL" onMouseDown={handleAllLogLevelsToggle}>
              <Checkbox
                checked={filters.logLevel.length === PLATFORM_LOG_LEVELS.length}
                indeterminate={
                  filters.logLevel.length > 0 &&
                  filters.logLevel.length < PLATFORM_LOG_LEVELS.length
                }
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

      <Grid item xs={12} md={2}>
        <FormControl fullWidth disabled={disabled} variant="outlined">
          <InputLabel id="platform-fields-label">Columns</InputLabel>
          <Select
            multiple
            value={filters.selectedFields}
            onChange={handleFieldsChange}
            labelId="platform-fields-label"
            label="Columns"
            renderValue={selected =>
              (selected as PlatformLogField[]).join(', ')
            }
          >
            {Object.values(PlatformLogField).map(field => (
              <MenuItem
                key={field}
                value={field}
                disabled={field === PlatformLogField.Log}
              >
                <Checkbox
                  checked={filters.selectedFields.includes(field)}
                  disabled={field === PlatformLogField.Log}
                />
                {field}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={2}>
        <TimeRangeFilter
          value={filters.timeRange}
          customStartTime={filters.customStartTime}
          customEndTime={filters.customEndTime}
          onChange={onFiltersChange}
          disabled={disabled}
        />
      </Grid>
    </Grid>
  );
};
