import { ReactNode } from 'react';
import { Box, Tooltip } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { useAuditLensesStyles, useResultColor } from './styles';
import { AUDIT_RESULTS, AuditQueryToken, AuditResult } from './types';
import { formatTotal } from './format';
import { AuditWindow } from './query';
import { useAuditFilterValues } from '../../hooks/useAuditFilterValues';

/**
 * The outcomes that get a tile. `unauthenticated` is left off: it is refused at
 * the boundary with no action resolved, so it says nothing about what was done
 * in this window. It stays filterable from the query bar and keeps its place in
 * the timeline.
 */
const LENS_RESULTS: AuditResult[] = ['success', 'failure', 'denied'];

/** Stands in for a count the aggregation did not answer. Zero would be a claim. */
const UNKNOWN_COUNT = '—';

const unknownNote = (unsupported: boolean): string =>
  unsupported
    ? 'This deployment serves the records but cannot count them, so this is unknown.'
    : 'The count could not be loaded. The records below are unaffected.';

export interface AuditLensesProps {
  window: AuditWindow;
  tokens: AuditQueryToken[];
  total: number;
  /** Replaces every `result` selection — a lens is a one-click result filter. */
  onSelectResults: (values: AuditResult[]) => void;
  enabled?: boolean;
}

interface LensTileProps {
  label: string;
  value: ReactNode;
  note?: string;
  color?: string;
  onClick?: () => void;
  active?: boolean;
  quiet?: boolean;
  tooltip?: string;
}

const LensTile = ({
  label,
  value,
  note,
  color,
  onClick,
  active,
  quiet,
  tooltip,
}: LensTileProps) => {
  const classes = useAuditLensesStyles();

  const className = [
    classes.lens,
    active ? classes.lensActive : '',
    quiet ? classes.lensQuiet : '',
    onClick ? '' : classes.lensStatic,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className={classes.lensKey}>
        {color && (
          <span
            className={classes.dot}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        {label}
      </span>
      <span className={classes.lensValue}>{value}</span>
      {note && <span className={classes.lensNote}>{note}</span>}
    </>
  );

  const tile = onClick ? (
    <button
      type="button"
      className={className}
      aria-pressed={Boolean(active)}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );

  return tooltip ? <Tooltip title={tooltip}>{tile}</Tooltip> : tile;
};

/**
 * The outcome tiles: how much happened in this window, and how much of it was
 * refused.
 *
 * Counts come from the filter-values aggregation on `result`, which ignores the
 * query's own `result` selection — so picking Denied does not leave the other
 * tiles reading zero, which is what counting over the filtered rows would do.
 * A per-value count is an ordering hint the observer may answer approximately,
 * unlike the exact `total` on the Events tile.
 */
export const AuditLenses = ({
  window: auditWindow,
  tokens,
  total,
  onSelectResults,
  enabled = true,
}: AuditLensesProps) => {
  const classes = useAuditLensesStyles();
  const colors = useResultColor();

  const {
    values,
    loading,
    error: resultsError,
    unsupported: resultsUnsupported,
  } = useAuditFilterValues({
    window: auditWindow,
    tokens,
    filter: 'result',
    enabled,
  });

  // Only the count is wanted here, not the list — asking for one value keeps a
  // high-cardinality aggregation's payload to nothing.
  const {
    totalValues: distinctActors,
    loading: actorsLoading,
    error: actorsError,
    unsupported: actorsUnsupported,
  } = useAuditFilterValues({
    window: auditWindow,
    tokens,
    filter: 'actor.id',
    maxValues: 1,
    enabled,
  });

  const countByResult = new Map(
    values.map(value => [value.value, value.count]),
  );
  const selectedResults = tokens
    .filter(token => token.path === 'result')
    .map(token => token.value);

  const onlyThisResult = (result: AuditResult) => () => {
    const alreadyOnly =
      selectedResults.length === 1 && selectedResults[0] === result;
    onSelectResults(alreadyOnly ? [] : [result]);
  };

  return (
    <Box className={classes.row}>
      <LensTile
        label="Events"
        value={formatTotal(total)}
        note="in this window, all outcomes"
        onClick={() => onSelectResults([])}
        active={selectedResults.length === 0}
      />
      {AUDIT_RESULTS.filter(result => LENS_RESULTS.includes(result.id)).map(
        result => {
          const count = countByResult.get(result.id) ?? 0;
          return (
            <LensTile
              key={result.id}
              label={result.label}
              value={
                loading ? (
                  <Skeleton variant="text" width={56} />
                ) : (
                  <>{resultsError ? UNKNOWN_COUNT : count.toLocaleString()}</>
                )
              }
              color={colors[result.id]}
              onClick={onlyThisResult(result.id)}
              active={
                selectedResults.length === 1 && selectedResults[0] === result.id
              }
              quiet={!loading && !resultsError && count === 0}
              tooltip={
                resultsError ? unknownNote(resultsUnsupported) : undefined
              }
            />
          );
        },
      )}
      <LensTile
        label="Distinct actors"
        value={
          actorsLoading ? (
            <Skeleton variant="text" width={40} />
          ) : (
            <>{actorsError ? UNKNOWN_COUNT : formatTotal(distinctActors)}</>
          )
        }
        note="users, service accounts and agents"
        tooltip={
          actorsError
            ? unknownNote(actorsUnsupported)
            : 'How many different actor.id values appear in this window.'
        }
      />
    </Box>
  );
};
