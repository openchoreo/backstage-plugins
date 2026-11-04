import { useId, useState, type ReactNode } from 'react';
import FormHelperText from '@material-ui/core/FormHelperText';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import useAsync from 'react-use/lib/useAsync';
import useDebounce from 'react-use/lib/useDebounce';
import { capitalized, useEntityLabel, useKindDisplay } from '../../kinds';

const RESULT_LIMIT = 20;

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  input: {
    flex: 1,
    minWidth: 0,
  },
}));

interface DryRunEntityFieldProps {
  /** Kinds to search within; every kind when empty. */
  kinds: string[];
  value: string;
  onChange: (entityRef: string) => void;
  error?: string;
  /**
   * Shown beside the input and centred on it. The helper text goes below
   * both, so its height doesn't shift the action.
   */
  action?: ReactNode;
}

/**
 * Picks the entity to dry-run against, searching the catalog by name or
 * title as you type. A typed entity ref is also accepted as is.
 */
export function DryRunEntityField({
  kinds,
  value,
  onChange,
  error,
  action,
}: DryRunEntityFieldProps) {
  const catalogApi = useApi(catalogApiRef);
  const kindDisplay = useKindDisplay();
  const entityLabel = useEntityLabel();
  const helperId = useId();
  const classes = useStyles();
  const [term, setTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  useDebounce(() => setDebouncedTerm(term), 250, [term]);
  const kindsKey = kinds.join(',');

  const { value: options = [], loading } = useAsync(async () => {
    const { items } = await catalogApi.queryEntities({
      filter: kindsKey ? { kind: kindsKey.split(',') } : undefined,
      fullTextFilter: debouncedTerm
        ? { term: debouncedTerm, fields: ['metadata.name', 'metadata.title'] }
        : undefined,
      fields: ['kind', 'metadata.name', 'metadata.namespace', 'metadata.title'],
      orderFields: { field: 'metadata.name', order: 'asc' },
      limit: RESULT_LIMIT,
    });
    return items;
  }, [catalogApi, kindsKey, debouncedTerm]);

  return (
    <div>
      <div className={classes.row}>
        <div className={classes.input}>
          <Autocomplete<Entity, false, false, true>
            freeSolo
            openOnFocus
            options={options}
            loading={loading}
            filterOptions={list => list}
            getOptionLabel={option =>
              typeof option === 'string' ? option : stringifyEntityRef(option)
            }
            renderOption={option => (
              <div>
                <Typography variant="body2">
                  {option.metadata.title ?? option.metadata.name}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {stringifyEntityRef(option)}
                </Typography>
              </div>
            )}
            inputValue={value}
            onInputChange={(_e, next, reason) => {
              onChange(next);
              // A picked option fills in its full ref; searching for that would
              // find nothing, so only typed text becomes the search term.
              if (reason === 'input') setTerm(next.split(/[:/]/).pop() ?? '');
            }}
            renderInput={params => (
              <TextField
                {...params}
                label={`${capitalized(
                  entityLabel.singular,
                )} to dry-run against`}
                placeholder="Search by name, or type a ref like component:default/name"
                error={!!error}
                inputProps={{
                  ...params.inputProps,
                  'aria-describedby': helperId,
                }}
              />
            )}
          />
        </div>
        {action}
      </div>
      <FormHelperText id={helperId} error={!!error} variant="outlined">
        {error ??
          (kinds.length > 0
            ? `Showing ${kinds.map(kindDisplay).join(', ')} ${
                entityLabel.plural
              }.`
            : `Showing ${entityLabel.plural} of every kind.`)}
      </FormHelperText>
    </div>
  );
}
