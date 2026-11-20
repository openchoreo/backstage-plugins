import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { GroupedSection } from '@openchoreo/backstage-plugin-react';
import {
  backendLabel,
  describeMatch,
  inMatchOrder,
  isMirror,
  sameMatch,
  splitOf,
} from '@openchoreo/backstage-plugin-common';
import { ConditionFields, toMatch, toRows } from './BackendPage';
import { RequestFlow } from './RequestFlow';
import { ShareFields, toDraft } from './ShareFields';
import { useBackendColors } from './TrafficSplitBar';
import type { EnvironmentTrafficDraft } from './useEnvironmentTrafficDraft';

/** The same card and hint as the Configuration tab next to it. */
const useStyles = makeStyles(theme => ({
  formCard: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: theme.spacing(3),
  },
  formHint: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    marginBottom: theme.spacing(2),
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  total: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    fontVariantNumeric: 'tabular-nums',
  },
  conditionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  grow: { flex: 1, minWidth: 0 },
}));

/**
 * The Traffic tab of an environment's Configure Overrides page: its shares,
 * copies and conditions, starting from what it serves now. Each group reads
 * Overrides when the environment differs from its release there, as the
 * Workload tab's groups do. The release decides how each backend gets
 * traffic; the environment only changes the values.
 */
export const EnvironmentTrafficTab = ({
  traffic,
  envLabel,
  disabled,
}: {
  traffic: EnvironmentTrafficDraft;
  envLabel: string;
  disabled?: boolean;
}) => {
  const classes = useStyles();
  const { info, served, release, draft, rows, defaultSplit, problem } = traffic;
  const colors = useBackendColors(info?.backends ?? [], release);
  const shared = served.filter(b => !isMirror(b));
  const mirrors = served.filter(isMirror);
  const rowsOf = (name: string) =>
    rows[name] ?? toRows(release.find(b => b.name === name)?.match);
  // Listed in the order the edited conditions take requests; each keeps the
  // release's condition for its default label and reset.
  const withMatch = release.filter(b => b.match && !isMirror(b));
  const conditioned = inMatchOrder(
    withMatch.map(b => ({ ...b, match: toMatch(rowsOf(b.name)) ?? b.match })),
  ).map(edited => withMatch.find(b => b.name === edited.name)!);
  // What the release this environment runs can render, as the draft checks it.
  const capabilities = traffic.env?.capabilities;
  const copyAll = capabilities && !capabilities.includes('MirrorPercent');
  const total = shared.reduce((s, b) => s + (Number(draft[b.name]) || 0), 0);
  const sharesOwn = shared.some(
    b => Number(draft[b.name]) !== defaultSplit[b.name],
  );
  const copiesOwn = mirrors.some(
    b => Number(draft[b.name]) !== defaultSplit[b.name],
  );
  const conditionsOwn = conditioned.some(
    b => !sameMatch(toMatch(rowsOf(b.name)), b.match),
  );
  const totalOff = Boolean(problem) && total !== 100;

  return (
    <Box className={classes.formCard}>
      <Typography className={classes.formHint}>
        Values that differ from the release are stored for {envLabel} only and
        apply right away. Everything else follows the release.
      </Typography>

      <GroupedSection
        title={traffic.dirty ? `${envLabel} after saving` : 'How requests flow'}
        count={served.length}
        status={traffic.own || traffic.dirty ? 'overridden' : 'inherited'}
      >
        <RequestFlow backends={traffic.preview} colors={colors} />
      </GroupedSection>

      {shared.length > 0 && (
        <GroupedSection
          title="Shares"
          titleTooltip={`Of the requests no condition takes; they add up to 100%. Default: ${shared
            .map(b => `${backendLabel(b)} ${defaultSplit[b.name]}%`)
            .join(', ')}.`}
          count={shared.length}
          status={sharesOwn ? 'overridden' : 'inherited'}
        >
          <Box className={classes.group}>
            <ShareFields
              backends={shared}
              draft={draft}
              initial={traffic.initialSplit}
              onChange={traffic.setDraft}
              colors={colors}
              disabled={disabled}
            />
            <Box className={classes.total}>
              <Typography
                variant="body2"
                color={totalOff ? 'error' : 'textSecondary'}
              >
                {totalOff ? problem : `Total ${total}%`}
              </Typography>
              {sharesOwn && (
                <Button
                  size="small"
                  color="primary"
                  disabled={disabled}
                  onClick={() =>
                    traffic.setDraft({
                      ...draft,
                      ...toDraft(splitOf(release.filter(b => !isMirror(b)))),
                    })
                  }
                >
                  Use default shares
                </Button>
              )}
            </Box>
          </Box>
        </GroupedSection>
      )}

      {mirrors.length > 0 && (
        <GroupedSection
          title="Copies"
          titleTooltip="A mirror gets copies of this share of requests and its answers are dropped, so it isn’t part of the shares."
          count={mirrors.length}
          status={copiesOwn ? 'overridden' : 'inherited'}
        >
          <Box className={classes.group}>
            <ShareFields
              backends={mirrors}
              draft={draft}
              initial={traffic.initialSplit}
              onChange={traffic.setDraft}
              colors={colors}
              label="Copy"
              disabled={disabled}
            />
            {copyAll && (
              <Typography
                variant="body2"
                color={
                  mirrors.some(b => {
                    const v = Number(draft[b.name]);
                    return v > 0 && v < 100;
                  })
                    ? 'error'
                    : 'textSecondary'
                }
              >
                This EndpointType copies every request or none: use 0% or 100%.
              </Typography>
            )}
          </Box>
        </GroupedSection>
      )}

      {conditioned.length > 0 && (
        <GroupedSection
          title="Conditions"
          titleTooltip={`Requests that meet every condition go to that backend in ${envLabel}, whatever the shares.`}
          count={conditioned.length}
          status={conditionsOwn ? 'overridden' : 'inherited'}
        >
          <Box className={classes.group}>
            <Typography variant="caption" color="textSecondary">
              The most specific condition wins: an exact path, then a longer
              path, then more headers and cookies. They are listed in that
              order.
            </Typography>
            {conditioned.map(b => {
              const current = rowsOf(b.name);
              const atDefault = sameMatch(toMatch(current), b.match);
              return (
                <Box key={b.name} className={classes.group}>
                  <Box className={classes.conditionHead}>
                    <span
                      className={classes.dot}
                      style={{ backgroundColor: colors.get(b.name) }}
                    />
                    <Box className={classes.grow}>
                      <Typography variant="body2" style={{ fontWeight: 500 }}>
                        {b.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Default: if {describeMatch(b.match!)}
                      </Typography>
                    </Box>
                    {!atDefault && (
                      <Button
                        size="small"
                        color="primary"
                        disabled={disabled}
                        onClick={() =>
                          traffic.setRows({
                            ...rows,
                            [b.name]: toRows(b.match),
                          })
                        }
                      >
                        Use default
                      </Button>
                    )}
                  </Box>
                  <ConditionFields
                    rows={current}
                    onChange={next =>
                      traffic.setRows({ ...rows, [b.name]: next })
                    }
                    regex={
                      !capabilities ||
                      capabilities.includes('RegularExpression')
                    }
                    disabled={disabled}
                  />
                </Box>
              );
            })}
            {problem && !totalOff && (
              <Typography variant="body2" color="error">
                {problem}
              </Typography>
            )}
          </Box>
        </GroupedSection>
      )}
    </Box>
  );
};
