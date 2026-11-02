import { useState, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import Collapse from '@material-ui/core/Collapse';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import CancelIcon from '@material-ui/icons/Cancel';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Link } from '@backstage/core-components';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import { formatFactValue } from '../../api/types';
import { useCodeStyles } from '../codeStyles';
import { RelativeTime } from '../RelativeTime';
import { TierChip } from '../TierChip';

const useStyles = makeStyles(() => ({
  toggle: {
    cursor: 'pointer',
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    display: 'block',
  },
  text: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  value: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    width: 'fit-content',
    maxWidth: '100%',
    maxHeight: 160,
    overflow: 'auto',
    margin: 0,
  },
}));

function Detail({ label, children }: { label: string; children: ReactNode }) {
  const classes = useStyles();
  return (
    <Box>
      <Typography
        variant="caption"
        color="textSecondary"
        className={classes.label}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export interface CheckResultItemProps {
  result: MaturityCheckResult;
  /** When each fact retriever last collected facts for the entity. */
  collectedAt?: Record<string, string>;
}

/**
 * One check's result on an entity's scorecard. Expanding it shows how to
 * pass the check, the collected values behind a failure, reference links,
 * and when its facts were collected. Failing checks start expanded.
 */
export function CheckResultItem({ result, collectedAt }: CheckResultItemProps) {
  const classes = useStyles();
  const codeClasses = useCodeStyles();
  const theme = useTheme();
  const { check } = result;
  const solution =
    typeof check.metadata?.solution === 'string'
      ? check.metadata.solution.trim()
      : '';
  const facts = Object.entries(result.facts ?? {});
  const links = check.links ?? [];
  const times = check.factIds
    .filter(id => collectedAt?.[id])
    .map(id => ({ id, at: collectedAt![id] }));
  const hasDetail =
    Boolean(solution) ||
    (!result.result && facts.length > 0) ||
    links.length > 0 ||
    times.length > 0;
  const [expanded, setExpanded] = useState(!result.result);

  return (
    <Box>
      <Box
        display="flex"
        alignItems="flex-start"
        className={hasDetail ? classes.toggle : undefined}
        onClick={hasDetail ? () => setExpanded(!expanded) : undefined}
      >
        {result.result ? (
          <CheckCircleIcon
            style={{ color: theme.palette.success.main, marginRight: 8 }}
          />
        ) : (
          <CancelIcon
            style={{ color: theme.palette.error.main, marginRight: 8 }}
          />
        )}
        <Box flexGrow={1} minWidth={0}>
          <Box display="flex" alignItems="center">
            <Typography variant="body1">{check.name}</Typography>
            {check.metadata?.rank !== undefined && (
              <Box ml={1}>
                <TierChip rank={check.metadata.rank} />
              </Box>
            )}
          </Box>
          {check.description && (
            <Typography variant="body2" color="textSecondary">
              {check.description}
            </Typography>
          )}
        </Box>
        {hasDetail && (
          <IconButton
            size="small"
            aria-label={expanded ? 'Hide details' : 'Show details'}
            aria-expanded={expanded}
            onClick={event => {
              event.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>
      {hasDetail && (
        <Collapse in={expanded}>
          <Box
            ml={4}
            mt={1}
            display="flex"
            flexDirection="column"
            style={{ gap: theme.spacing(1.5) }}
          >
            {solution && (
              <Detail label="How to pass">
                <Typography variant="body2" className={classes.text}>
                  {solution}
                </Typography>
              </Detail>
            )}
            {!result.result && facts.length > 0 && (
              <Detail label="Collected values">
                <Box
                  display="flex"
                  flexDirection="column"
                  style={{ gap: theme.spacing(0.5) }}
                >
                  {facts.map(([name, fact]) => (
                    <Box key={name}>
                      <Typography variant="body2">
                        {fact.description || name}
                      </Typography>
                      <pre
                        className={`${classes.value} ${codeClasses.codeBlock}`}
                      >
                        {formatFactValue(fact.value)}
                      </pre>
                    </Box>
                  ))}
                </Box>
              </Detail>
            )}
            {links.length > 0 && (
              <Detail label="References">
                <Typography variant="body2">
                  {links.map((link, index) => (
                    <span key={link.url}>
                      {index > 0 && ' · '}
                      <Link to={link.url}>{link.title}</Link>
                    </span>
                  ))}
                </Typography>
              </Detail>
            )}
            {times.length > 0 && (
              <Detail label="Facts collected">
                {times.map(({ id, at }) => (
                  <Typography key={id} variant="body2">
                    {times.length > 1 && `${id}: `}
                    <RelativeTime iso={at} />
                  </Typography>
                ))}
              </Detail>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
