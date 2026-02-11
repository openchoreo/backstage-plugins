import { useState, useEffect, useMemo } from 'react';
import { TextField, InputAdornment, IconButton } from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import ClearIcon from '@material-ui/icons/Clear';
import {
  useEntityList,
  EntityTextFilter,
} from '@backstage/plugin-catalog-react';
import { useDebounce } from 'react-use';
import { useStyles } from './styles';

export const ScaffolderSearchBar = () => {
  const classes = useStyles();
  const {
    updateFilters,
    queryParameters: { text: textParameter },
  } = useEntityList();

  const queryParamTextFilter = useMemo(
    () => [textParameter].flat()[0],
    [textParameter],
  );

  const [search, setSearch] = useState(queryParamTextFilter ?? '');

  useDebounce(
    () => {
      updateFilters({
        text: search.length ? new EntityTextFilter(search) : undefined,
      });
    },
    250,
    [search, updateFilters],
  );

  useEffect(() => {
    if (queryParamTextFilter) {
      setSearch(queryParamTextFilter);
    }
  }, [queryParamTextFilter]);

  return (
    <TextField
      className={classes.searchBar}
      placeholder="Search templates..."
      variant="outlined"
      size="small"
      value={search}
      onChange={e => setSearch(e.target.value)}
      InputProps={{
        style: { height: 44 },
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: search ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  );
};
