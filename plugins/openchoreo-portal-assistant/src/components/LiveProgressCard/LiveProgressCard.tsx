import { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import type { DryRunResult } from '../../api/PortalAssistantApi';
import { useCardStyles } from '../AgentUi/cardStyles';
import { LineView } from '../AgentUi/ReplyCard';
import { ResultChip } from '../AgentUi/TestCard';

const useStyles = makeStyles(theme => ({
  line: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  spinner: { flex: 'none', color: theme.palette.primary.main },
  step: { color: theme.palette.text.primary },
  result: { marginTop: theme.spacing(1.25) },
  resultHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
}));

/** Whole seconds since `startedAt`, ticking once a second until `stopped`. */
const useSeconds = (startedAt: number, stopped: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (stopped) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stopped]);
  return Math.max(0, Math.round((now - startedAt) / 1000));
};

/**
 * What a check authoring turn is doing while its reply is held back, as
 * one line that changes in place: a spinner, the step the agent is on now
 * (the latest tool_call's activeForm, shown the moment it comes, "Thinking"
 * between a tool's result and the next step) and the time so far. No list
 * of steps and no ticks (2026-11-25). `ready` once the reply has arrived: the same
 * line says how long it took, with no icon, and the time stops. A
 * dry-run's result shows under the line as soon as it comes back, in its
 * test card's words.
 */
export const LiveProgressCard = ({
  steps,
  result,
  startedAt,
  ready = false,
  title: busyTitle = 'Working on it',
  status = 'Thinking',
}: {
  steps: string[];
  result?: DryRunResult;
  startedAt: number;
  ready?: boolean;
  /** Its name for screen readers while working; any request, not only a check. */
  title?: string;
  /** What it says before any step is reported. */
  status?: string;
}) => {
  const cardClasses = useCardStyles();
  const classes = useStyles();
  const seconds = useSeconds(startedAt, ready);
  const step: string | undefined = steps[steps.length - 1];
  return (
    <Box role="status" aria-label={ready ? 'Ready' : busyTitle}>
      <Box className={classes.line}>
        {ready ? (
          <Typography variant="body2" component="span">
            {`Done in ${seconds}s`}
          </Typography>
        ) : (
          <>
            <CircularProgress
              size={14}
              thickness={5}
              className={classes.spinner}
              aria-label="In progress"
            />
            <Typography variant="body2" component="span">
              <span className={classes.step}>{step ?? status}</span>
              <span aria-hidden="true"> · {seconds}s</span>
            </Typography>
          </>
        )}
      </Box>
      {result && (
        <Box className={`${cardClasses.card} ${classes.result}`}>
          <Box className={cardClasses.section}>
            <Box className={classes.resultHead}>
              <span className={cardClasses.sectionLabel}>
                Test on {result.title}
              </span>
              <ResultChip status={result.status} />
            </Box>
            <Typography variant="body2">{result.summary}</Typography>
          </Box>
          {result.sections.map(section => (
            <Box key={section.label} className={cardClasses.section}>
              <span className={cardClasses.sectionLabel}>{section.label}</span>
              {section.lines.map(line => (
                <LineView
                  key={line.label}
                  label={line.label}
                  value={line.value}
                />
              ))}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
