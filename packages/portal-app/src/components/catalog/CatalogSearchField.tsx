import { useEffect, useMemo, useState } from 'react';
import { IconButton, InputBase } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import ClearIcon from '@material-ui/icons/Clear';
import {
  EntityTextFilter,
  useEntityList,
} from '@backstage/plugin-catalog-react';

// Replaces Backstage's EntitySearchBar so the styling and clear button (shown
// only when there's text) are under our control. Drives the same EntityTextFilter.
const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    height: 38,
    width: 240,
    maxWidth: '100%',
    padding: theme.spacing(0, 1),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    transition: 'border-color 0.15s ease-in-out',
    '&:focus-within': {
      borderColor: theme.palette.primary.main,
    },
  },
  searchIcon: {
    color: theme.palette.text.secondary,
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: '0.875rem',
  },
  clearButton: {
    padding: 2,
    flexShrink: 0,
  },
  clearIcon: {
    fontSize: '1rem',
  },
}));

const DEBOUNCE_MS = 250;

export const CatalogSearchField = () => {
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

  // Debounce writes to the entity list so typing doesn't refetch on every key.
  useEffect(() => {
    const handle = setTimeout(() => {
      updateFilters({
        text: search.length ? new EntityTextFilter(search) : undefined,
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, updateFilters]);

  // Adopt a text filter arriving via the URL (e.g. a deep link).
  useEffect(() => {
    if (queryParamTextFilter) {
      setSearch(queryParamTextFilter);
    }
  }, [queryParamTextFilter]);

  return (
    <div className={classes.root}>
      <SearchIcon className={classes.searchIcon} />
      <InputBase
        className={classes.input}
        placeholder="Search"
        value={search}
        inputProps={{ 'aria-label': 'search' }}
        onChange={event => setSearch(event.target.value)}
      />
      {search.length > 0 && (
        <IconButton
          className={classes.clearButton}
          aria-label="clear search"
          onClick={() => setSearch('')}
        >
          <ClearIcon className={classes.clearIcon} />
        </IconButton>
      )}
    </div>
  );
};
