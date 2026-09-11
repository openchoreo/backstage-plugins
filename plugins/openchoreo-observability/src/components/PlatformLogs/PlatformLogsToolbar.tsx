import { FC } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import ClearIcon from '@material-ui/icons/Clear';
import FiberManualRecord from '@material-ui/icons/FiberManualRecord';
import FilterListIcon from '@material-ui/icons/FilterList';
import Refresh from '@material-ui/icons/Refresh';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { TimeRangeFilter } from '@openchoreo/backstage-plugin-react';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import {
  CLUSTER_OBSERVABILITY_PLANE_KIND,
  type ObservabilityPlaneOption,
} from '../../hooks/useObservabilityPlanes';
import { activeFilters, clearedFilters } from './activeFilters';
import { usePlatformLogsToolbarStyles } from './styles';
import { PlatformLogsFilters } from './types';
import { validateSearchPhrase } from './validation';

const isClusterScoped = (plane: ObservabilityPlaneOption) =>
  plane.kind === CLUSTER_OBSERVABILITY_PLANE_KIND;

/**
 * What distinguishes two planes that share a name, spelled out under the name in the
 * open list. A cluster-scoped plane has no meaningful namespace, so naming its kind is
 * the whole answer; a namespaced one needs the namespace as well.
 */
export function planeScope(plane: ObservabilityPlaneOption): string {
  return isClusterScoped(plane)
    ? CLUSTER_OBSERVABILITY_PLANE_KIND
    : `ObservabilityPlane · ${plane.namespace}`;
}

/**
 * The same distinction for the closed field, which shares a row with everything else
 * and has no room for a kind name. "ns:" is kept on the namespace because a plane
 * named "default" in namespace "default" is otherwise indistinguishable from the
 * cluster-scoped one beside it - which is exactly the case this is here for.
 */
export function planeScopeShort(plane: ObservabilityPlaneOption): string {
  return isClusterScoped(plane) ? 'cluster' : `ns: ${plane.namespace}`;
}

interface PlatformLogsToolbarProps {
  filters: PlatformLogsFilters;
  onFiltersChange: (filters: Partial<PlatformLogsFilters>) => void;
  planes: ObservabilityPlaneOption[];
  planesLoading: boolean;
  /** Whether the filter row below is open. */
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onRefresh: () => void;
  disabled?: boolean;
}

/**
 * The always-visible controls: where to query, over what window, free-text search, and
 * the two actions that re-run the query.
 *
 * Everything here either changes the data source or is reached for constantly. The
 * controls that narrow the result set live in the filter row this toolbar toggles, and
 * are summarised as chips underneath so a collapsed row never hides what is applied.
 */
export const PlatformLogsToolbar: FC<PlatformLogsToolbarProps> = ({
  filters,
  onFiltersChange,
  planes,
  planesLoading,
  filtersOpen,
  onToggleFilters,
  onRefresh,
  disabled = false,
}) => {
  const classes = usePlatformLogsToolbarStyles();
  const [searchInput, handleSearchChange, clearSearch] = useDebouncedSearch(
    filters.searchQuery,
    value => {
      if (!validateSearchPhrase(value)) onFiltersChange({ searchQuery: value });
    },
  );

  const searchError = validateSearchPhrase(searchInput);

  const chips = activeFilters(filters);

  // A fixed upper bound cannot produce new rows, so tailing it would be a button that
  // is on and does nothing.
  const liveUnavailable = filters.timeRange === 'custom';

  let liveTooltip = filters.isLive ? 'Stop live tail' : 'Tail new entries';
  if (liveUnavailable) {
    liveTooltip = 'Live tail needs a relative time range';
  }

  return (
    <Box className={classes.root}>
      <Box className={classes.bar}>
        <FormControl
          variant="outlined"
          size="small"
          className={classes.plane}
          disabled={disabled || planesLoading}
        >
          <InputLabel id="platform-logs-plane">Observability Plane</InputLabel>
          {planesLoading ? (
            <Skeleton variant="rect" height={40} />
          ) : (
            <Select
              labelId="platform-logs-plane"
              label="Observability Plane"
              value={filters.observabilityPlane}
              onChange={event =>
                onFiltersChange({
                  observabilityPlane: event.target.value as string,
                })
              }
              // Without this the closed field renders the chosen item's children,
              // which here are two lines and would break the bar's height.
              renderValue={value => {
                const plane = planes.find(p => p.ref === value);
                if (!plane) return value as string;
                return `${plane.displayName} (${planeScopeShort(plane)})`;
              }}
            >
              {planes.map(plane => (
                <MenuItem key={plane.ref} value={plane.ref}>
                  <span className={classes.planeOption}>
                    <span>{plane.displayName}</span>
                    <Typography variant="caption" color="textSecondary">
                      {planeScope(plane)}
                    </Typography>
                  </span>
                </MenuItem>
              ))}
            </Select>
          )}
        </FormControl>

        <TextField
          className={classes.search}
          size="small"
          variant="outlined"
          placeholder="Search log messages…"
          error={Boolean(searchError)}
          helperText={searchError}
          value={searchInput}
          onChange={handleSearchChange}
          disabled={disabled}
          inputProps={{ 'aria-label': 'Search log messages' }}
          InputProps={{
            endAdornment: searchInput ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  aria-label="Clear search"
                  onClick={clearSearch}
                  disabled={disabled}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        <Box className={classes.timeRange}>
          <TimeRangeFilter
            value={filters.timeRange}
            customStartTime={filters.customStartTime}
            customEndTime={filters.customEndTime}
            onChange={onFiltersChange}
            disabled={disabled}
            size="small"
          />
        </Box>

        <Button
          variant={filtersOpen ? 'contained' : 'outlined'}
          color={filtersOpen ? 'primary' : 'default'}
          size="small"
          onClick={onToggleFilters}
          startIcon={<FilterListIcon />}
          aria-expanded={filtersOpen}
          aria-controls="platform-logs-filter-row"
          className={classes.action}
        >
          Filters
          {chips.length > 0 && (
            <Chip
              component="span"
              size="small"
              label={chips.length}
              className={classes.countBadge}
            />
          )}
        </Button>

        <Tooltip title={liveTooltip}>
          {/* Tooltip needs a non-disabled child to stay hoverable, hence the span. */}
          <span>
            <Button
              variant="outlined"
              size="small"
              disabled={disabled || liveUnavailable}
              onClick={() => onFiltersChange({ isLive: !filters.isLive })}
              aria-pressed={Boolean(filters.isLive)}
              className={classes.action}
              startIcon={
                <FiberManualRecord
                  className={filters.isLive ? classes.liveOn : classes.liveOff}
                />
              }
            >
              Live
            </Button>
          </span>
        </Tooltip>

        <Button
          variant="outlined"
          size="small"
          onClick={onRefresh}
          disabled={disabled}
          className={classes.action}
          startIcon={<Refresh fontSize="small" />}
        >
          Refresh
        </Button>
      </Box>

      {chips.length > 0 && (
        <Box className={classes.chips}>
          {chips.map(chip => (
            <Chip
              key={chip.id}
              size="small"
              label={chip.label}
              onDelete={() => onFiltersChange(chip.cleared)}
              disabled={disabled}
              className={classes.chip}
            />
          ))}
          <Button
            size="small"
            onClick={() => onFiltersChange(clearedFilters())}
            disabled={disabled}
            className={classes.clearAll}
          >
            Clear all
          </Button>
        </Box>
      )}
    </Box>
  );
};
