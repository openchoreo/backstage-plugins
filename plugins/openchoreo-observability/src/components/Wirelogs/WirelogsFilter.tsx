import { FC } from 'react';
import { Box, Button, InputAdornment, TextField } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import GetAppIcon from '@material-ui/icons/GetApp';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import StopIcon from '@material-ui/icons/Stop';
import ClearAllIcon from '@material-ui/icons/ClearAll';
import {
  EnvironmentFilter,
  type Environment,
} from '@openchoreo/backstage-plugin-react';
import { useDebouncedSearch } from '../../hooks/useDebouncedSearch';
import { useWirelogsStyles } from './styles';
import type { WirelogsFilters, WirelogStreamStatus } from './types';

interface WirelogsFilterProps {
  filters: WirelogsFilters;
  onFiltersChange: (filters: Partial<WirelogsFilters>) => void;
  environments: Environment[];
  environmentsLoading: boolean;
  status: WirelogStreamStatus;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  onDownload: () => void;
  disabled?: boolean;
}

export const WirelogsFilter: FC<WirelogsFilterProps> = ({
  filters,
  onFiltersChange,
  environments,
  environmentsLoading,
  status,
  onStart,
  onStop,
  onClear,
  onDownload,
  disabled = false,
}) => {
  const classes = useWirelogsStyles();
  const [searchInput, handleSearchChange] = useDebouncedSearch(
    filters.searchQuery,
    value => onFiltersChange({ searchQuery: value }),
  );

  const isStreaming = status === 'streaming' || status === 'connecting';

  return (
    <Box className={classes.toolbar}>
      <Box className={classes.envControl}>
        <EnvironmentFilter
          environments={environments}
          loading={environmentsLoading}
          value={filters.environment}
          onChange={env => onFiltersChange({ environment: env })}
          disabled={disabled}
        />
      </Box>

      <TextField
        className={classes.filterField}
        size="small"
        placeholder="Filter flows by verdict, workload, IP, path or status…"
        variant="outlined"
        value={searchInput}
        onChange={handleSearchChange}
        disabled={disabled}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />

      {isStreaming ? (
        <Button
          size="small"
          variant="contained"
          className={classes.stopButton}
          onClick={onStop}
          disableElevation
          startIcon={<StopIcon />}
        >
          Stop stream
        </Button>
      ) : (
        <Button
          size="small"
          variant="contained"
          className={classes.startButton}
          onClick={onStart}
          disableElevation
          disabled={disabled || !filters.environment}
          startIcon={<PlayArrowIcon />}
        >
          Start stream
        </Button>
      )}
      <Button
        size="small"
        variant="outlined"
        className={classes.toolbarButton}
        onClick={onClear}
        startIcon={<ClearAllIcon />}
      >
        Clear
      </Button>
      <Button
        size="small"
        variant="outlined"
        className={classes.toolbarButton}
        onClick={onDownload}
        startIcon={<GetAppIcon />}
      >
        Download
      </Button>
    </Box>
  );
};
