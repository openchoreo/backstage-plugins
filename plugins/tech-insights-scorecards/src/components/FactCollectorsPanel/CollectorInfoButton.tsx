import { useState } from 'react';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Popover from '@material-ui/core/Popover';
import Typography from '@material-ui/core/Typography';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { makeStyles } from '@material-ui/core/styles';
import { factFieldsOf, type FactSchema } from '../../api/types';
import { kindsOfFilter, useEntityLabel, useKindDisplay } from '../../kinds';
import { useCodeStyles } from '../codeStyles';

const useStyles = makeStyles(theme => ({
  paper: {
    padding: theme.spacing(2),
    maxWidth: 480,
    maxHeight: 420,
  },
  facts: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  factName: {
    wordBreak: 'break-all',
  },
}));

/** The entities a retriever collects for, as a phrase: "Components". */
export function useCoveredKindsText(): (schema: FactSchema) => string {
  const kindDisplay = useKindDisplay();
  const entityLabel = useEntityLabel();
  return schema => {
    const kinds = kindsOfFilter(schema.entityFilter);
    return kinds === 'all'
      ? `Every ${entityLabel.singular}`
      : kinds.map(kindDisplay).join(', ');
  };
}

/**
 * An info button that shows what a fact collector covers and the facts it
 * collects, with each fact's type and description from its schema.
 */
export function CollectorInfoButton({ schema }: { schema: FactSchema }) {
  const classes = useStyles();
  const codeClasses = useCodeStyles();
  const coveredKinds = useCoveredKindsText();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const facts = factFieldsOf(schema);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`About ${schema.id}`}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <InfoOutlinedIcon fontSize="small" />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        classes={{ paper: classes.paper }}
      >
        <Typography variant="subtitle2">{schema.id}</Typography>
        <Typography variant="body2" color="textSecondary">
          Collects for: {coveredKinds(schema)} · version {schema.version}
        </Typography>
        <Box mt={1.5}>
          <Typography variant="overline" color="textSecondary">
            Facts it collects
          </Typography>
          {facts.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Its schema lists no facts.
            </Typography>
          ) : (
            <ul className={classes.facts}>
              {facts.map(({ name, field }) => (
                <li key={name}>
                  <Typography variant="body2" component="div">
                    <span className={`${codeClasses.code} ${classes.factName}`}>
                      {name}
                    </span>{' '}
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      component="span"
                    >
                      {field.type}
                    </Typography>
                  </Typography>
                  {field.description && (
                    <Typography variant="body2" color="textSecondary">
                      {field.description}
                    </Typography>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Box>
      </Popover>
    </>
  );
}
