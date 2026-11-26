import { useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import useAsync from 'react-use/lib/useAsync';
import useDebounce from 'react-use/lib/useDebounce';
import { useButtonStyles } from '../AgentUi/cardStyles';

const RESULT_LIMIT = 20;

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  input: { flex: 1, minWidth: 0 },
}));

/** "component" → "components", for the search box's placeholder. */
const plural = (kind: string) => {
  const lower = kind.toLowerCase();
  return lower.endsWith('s') ? lower : `${lower}s`;
};

/**
 * A searchable list of the catalog's entities to test a check on, with a
 * Test button. It searches by name or title as you type (on the server,
 * like the check form's DryRunEntityField) and only takes a picked entity,
 * so the agent always gets a full ref such as component:default/order-api.
 */
export const ComponentPicker = ({
  kinds,
  disabled = false,
  onTest,
}: {
  /** Kinds to list; Components when empty. */
  kinds: string[];
  disabled?: boolean;
  /** Called with the picked entity's ref when Test is clicked. */
  onTest: (entityRef: string) => void;
}) => {
  const catalogApi = useApi(catalogApiRef);
  const classes = useStyles();
  const buttonClasses = useButtonStyles();
  const [picked, setPicked] = useState<Entity | null>(null);
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  useDebounce(() => setDebouncedTerm(term), 250, [term]);
  const shown = kinds.length > 0 ? kinds : ['component'];
  const kindsKey = shown.join(',');

  const {
    value: options = [],
    loading,
    error,
  } = useAsync(async () => {
    const { items } = await catalogApi.queryEntities({
      filter: { kind: kindsKey.split(',') },
      fullTextFilter: debouncedTerm
        ? { term: debouncedTerm, fields: ['metadata.name', 'metadata.title'] }
        : undefined,
      fields: ['kind', 'metadata.name', 'metadata.namespace', 'metadata.title'],
      orderFields: { field: 'metadata.name', order: 'asc' },
      limit: RESULT_LIMIT,
    });
    return items;
  }, [catalogApi, kindsKey, debouncedTerm]);

  const name = shown.length === 1 ? plural(shown[0]) : 'entities';
  return (
    <Box>
      <Box className={classes.row}>
        <Autocomplete<Entity>
          className={classes.input}
          size="small"
          openOnFocus
          disabled={disabled}
          options={options}
          loading={loading}
          // The catalog already filtered by what was typed.
          filterOptions={list => list}
          value={picked}
          onChange={(_e, next) => setPicked(next)}
          onInputChange={(_e, next, reason) => {
            // Typing and ✕ change the search; picking an option only shows its name.
            if (reason === 'input' || reason === 'clear') setTerm(next);
          }}
          getOptionLabel={option =>
            option.metadata.title ?? option.metadata.name
          }
          getOptionSelected={(option, value) =>
            stringifyEntityRef(option) === stringifyEntityRef(value)
          }
          noOptionsText={`No ${name} found`}
          renderOption={option => (
            <Box>
              <Typography variant="body2">
                {option.metadata.title ?? option.metadata.name}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {stringifyEntityRef(option)}
              </Typography>
            </Box>
          )}
          renderInput={params => (
            <TextField
              {...params}
              variant="outlined"
              placeholder={`Search ${name}`}
              inputProps={{
                ...params.inputProps,
                'aria-label': 'Component to test on',
              }}
            />
          )}
        />
        <Button
          size="small"
          variant="contained"
          className={`${buttonClasses.button} ${
            !picked || disabled ? '' : buttonClasses.primary
          }`}
          disabled={!picked || disabled}
          onClick={() => picked && onTest(stringifyEntityRef(picked))}
        >
          Test
        </Button>
      </Box>
      {error && (
        <Typography variant="caption" color="error">
          Couldn't load {name} from the catalog.
        </Typography>
      )}
    </Box>
  );
};
