import { useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import { useApi } from '@backstage/core-plugin-api';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { DryRunResult, DryRunStatus } from '../../api/types';
import { useCodeStyles } from '../codeStyles';
import { RelativeTime } from '../RelativeTime';
import { useCheckPermissions } from '../useCheckPermissions';

const STATUS_DISPLAY: Record<
  DryRunStatus,
  { severity: 'success' | 'warning' | 'info' | 'error'; title: string }
> = {
  passed: { severity: 'success', title: 'Passed' },
  failed: { severity: 'warning', title: 'Failed' },
  'not-applicable': { severity: 'info', title: 'No result' },
  invalid: { severity: 'error', title: "The check can't be evaluated" },
};

interface EvaluatedCondition {
  fact: string;
  operator: string;
  value: unknown;
  factResult: unknown;
  result?: boolean;
  negated: boolean;
}

function evaluatedConditions(
  node: unknown,
  negated = false,
): EvaluatedCondition[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Record<string, unknown>;
  if (Array.isArray(n.all))
    return n.all.flatMap(c => evaluatedConditions(c, negated));
  if (Array.isArray(n.any))
    return n.any.flatMap(c => evaluatedConditions(c, negated));
  if ('not' in n) return evaluatedConditions(n.not, !negated);
  if (typeof n.fact !== 'string') return [];
  return [
    {
      fact: n.fact,
      operator: String(n.operator),
      value: n.value,
      factResult: n.factResult,
      result: typeof n.result === 'boolean' ? n.result : undefined,
      negated,
    },
  ];
}

function display(value: unknown) {
  return value === undefined ? '—' : JSON.stringify(value);
}

/** A collected value; null is what an unresolved entity reports. */
function displayActual(value: unknown) {
  return value === null ? 'No value' : display(value);
}

type CollectState = 'started' | 'already-running' | { error: string };

export function DryRunResultView({ result }: { result: DryRunResult }) {
  const api = useApi(dynamicChecksApiRef);
  const codeClasses = useCodeStyles();
  const { canManage } = useCheckPermissions();
  const [collect, setCollect] = useState<Record<string, CollectState>>({});
  const { severity, title } = STATUS_DISPLAY[result.status];
  const conditions = evaluatedConditions(result.conditions);

  async function collectNow(retrieverId: string) {
    try {
      const outcome = await api.triggerFactCollector(retrieverId);
      setCollect(prev => ({ ...prev, [retrieverId]: outcome }));
    } catch (e) {
      setCollect(prev => ({
        ...prev,
        [retrieverId]: { error: (e as Error).message },
      }));
    }
  }

  return (
    <Box>
      <Alert severity={severity}>
        <AlertTitle>
          {title} for {result.entityRef}
        </AlertTitle>
        {result.reasons.map((reason, i) => {
          const state = reason.factRetrieverId
            ? collect[reason.factRetrieverId]
            : undefined;
          return (
            <Box key={i} mt={i > 0 ? 1 : 0}>
              <Typography variant="body2">{reason.message}</Typography>
              {reason.code === 'no-facts' &&
                reason.factRetrieverId &&
                canManage && (
                  <Box
                    mt={0.5}
                    display="flex"
                    alignItems="center"
                    style={{ gap: 8 }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AutorenewIcon fontSize="small" />}
                      onClick={() => collectNow(reason.factRetrieverId!)}
                    >
                      Collect now
                    </Button>
                    {state === 'started' && (
                      <Typography variant="caption">
                        Collection started. Dry-run again once it finishes (see
                        Data sources).
                      </Typography>
                    )}
                    {state === 'already-running' && (
                      <Typography variant="caption">
                        Already collecting. Dry-run again once it finishes.
                      </Typography>
                    )}
                    {state && typeof state === 'object' && (
                      <Typography variant="caption" color="error">
                        {state.error}
                      </Typography>
                    )}
                  </Box>
                )}
            </Box>
          );
        })}
      </Alert>

      {conditions.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fact</TableCell>
              <TableCell>Actual</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell align="right">Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {conditions.map((c, i) => (
              <TableRow key={i}>
                <TableCell className={codeClasses.code}>{c.fact}</TableCell>
                <TableCell className={codeClasses.code}>
                  {displayActual(c.factResult)}
                </TableCell>
                <TableCell className={codeClasses.code}>
                  {c.negated ? 'not ' : ''}
                  {c.operator} {display(c.value)}
                </TableCell>
                <TableCell align="right">
                  {c.result === undefined && '—'}
                  {c.result === true && <CheckIcon fontSize="small" />}
                  {c.result === false && <CloseIcon fontSize="small" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {Object.keys(result.collectedAt).length > 0 && (
        <Box mt={1}>
          {Object.entries(result.collectedAt).map(([id, at]) => (
            <Typography
              key={id}
              variant="caption"
              color="textSecondary"
              component="div"
            >
              {id}: facts collected <RelativeTime iso={at} />
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
