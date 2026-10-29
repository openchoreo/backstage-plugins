import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import ClearIcon from '@material-ui/icons/Clear';
import SearchIcon from '@material-ui/icons/Search';
import { useProjectContentsCardStyles } from '../Projects/ProjectContentsCard/styles';

export interface ReleaseLineSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** Filters release lines by name, like the project contents search field. */
export function ReleaseLineSearchField({
  value,
  onChange,
}: ReleaseLineSearchFieldProps) {
  const classes = useProjectContentsCardStyles();

  return (
    <TextField
      className={classes.searchField}
      variant="outlined"
      size="small"
      placeholder="Search by name"
      value={value}
      onChange={event => onChange(event.target.value)}
      inputProps={{ 'aria-label': 'Search by name' }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              aria-label="Clear filter"
              onClick={() => onChange('')}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
}
