import { type MouseEvent, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import type { BindingRevisionHistoryLimit } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { getErrorMessage } from '../../../utils/errorUtils';
import type { BindingKind } from '../utils/revisionUtils';

/** The highest limit the portal accepts; the backend enforces the same. */
export const MAX_REVISION_HISTORY_LIMIT = 1000;

const useStyles = makeStyles(theme => ({
  popover: {
    width: 340,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  field: {
    width: 140,
  },
  note: {
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
  warning: {
    color: theme.palette.warning.main,
    fontSize: 12,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  actionsEnd: {
    marginLeft: 'auto',
    display: 'flex',
    gap: theme.spacing(1),
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

/**
 * The text of a typed limit as a number, or null when it is not a whole
 * number from 0 to MAX_REVISION_HISTORY_LIMIT.
 */
export const parseHistoryLimit = (text: string): number | null => {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n <= MAX_REVISION_HISTORY_LIMIT ? n : null;
};

/** Where a binding that sets no limit of its own takes it from. */
export const inheritedLimitText = (limit: BindingRevisionHistoryLimit) => {
  if (limit.environmentLimitUnreadable) {
    return "the environment's limit, which could not be read";
  }
  return limit.environmentLimit !== null
    ? `the environment's limit of ${limit.environmentLimit}`
    : 'the platform default';
};

/**
 * Warns what Reset will do, from the limit the binding inherits once its own
 * is cleared. Reset saves at once, so this is shown before it is clicked.
 * Returns null when Reset deletes nothing.
 */
export const resetWarning = (
  limit: BindingRevisionHistoryLimit,
  oldRevisionCount: number,
  environmentName: string,
): string | null => {
  if (limit.environmentLimitUnreadable) {
    return `Reset uses the environment's limit, which could not be read: it may delete old revisions, or with a limit of 0 stop ${environmentName} from being rolled back.`;
  }
  if (limit.environmentLimit === null) {
    return oldRevisionCount > 0
      ? `Reset uses the platform default: if it is below the ${oldRevisionCount} old ${
          oldRevisionCount === 1 ? 'revision' : 'revisions'
        } kept now, the oldest are deleted.`
      : null;
  }
  if (limit.environmentLimit === 0) {
    return `Reset uses the environment's limit of 0: no old revision is kept, so ${environmentName} cannot be rolled back.`;
  }
  const removed = Math.max(oldRevisionCount - limit.environmentLimit, 0);
  return removed > 0
    ? `Reset deletes up to ${removed} of the oldest ${
        removed === 1 ? 'revision' : 'revisions'
      }. They cannot be restored.`
    : null;
};

/** The footer button's label: the limit in effect, as far as it is known. */
export const historyLimitLabel = (
  limit: BindingRevisionHistoryLimit | null,
): string => {
  if (!limit) return 'History limit';
  if (limit.bindingLimit !== null) {
    return `History limit: ${limit.bindingLimit}`;
  }
  if (limit.environmentLimitUnreadable) {
    return 'History limit: unknown';
  }
  if (limit.environmentLimit !== null) {
    return `History limit: ${limit.environmentLimit} (environment)`;
  }
  return 'History limit: default';
};

export interface RevisionHistoryLimitControlProps {
  /** Whose binding: a Component's ReleaseBinding or a Resource's. */
  kind: BindingKind;
  bindingName: string;
  /** The environment's display name, e.g. "Development". */
  environmentName: string;
  /** Old (inactive) revisions the binding keeps now, to warn before trimming. */
  oldRevisionCount: number;
  /** Whether the user may change the binding. */
  canUpdate: boolean;
  /** Why the user may not, when canUpdate is false. */
  deniedTooltip: string;
  /** Called after a new limit is saved. */
  onChanged: (limit: BindingRevisionHistoryLimit) => void;
}

/**
 * Shows a binding's revision history limit in the Revision Browser's footer
 * and changes it from a popover. The limit is how many old revisions are
 * kept for rollback; the active revision is always kept on top of it. A
 * binding that sets none uses its environment's limit, or else the
 * platform default. Changing the limit is not a deployment: no revision is
 * recorded, and lowering it deletes the oldest revisions.
 */
export const RevisionHistoryLimitControl = ({
  kind,
  bindingName,
  environmentName,
  oldRevisionCount,
  canUpdate,
  deniedTooltip,
  onChanged,
}: RevisionHistoryLimitControlProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);
  const { entity } = useEntity();

  const [limit, setLimit] = useState<BindingRevisionHistoryLimit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setLimit(
        await client.getBindingRevisionHistoryLimit(entity, kind, bindingName),
      );
    } catch (e) {
      setLoadError(getErrorMessage(e));
    }
  }, [client, entity, kind, bindingName]);

  useEffect(() => {
    let cancelled = false;
    setLimit(null);
    setLoadError(null);
    client
      .getBindingRevisionHistoryLimit(entity, kind, bindingName)
      .then(result => !cancelled && setLimit(result))
      .catch(e => !cancelled && setLoadError(getErrorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [client, entity, kind, bindingName]);

  const open = (event: MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
    setText(
      limit && limit.bindingLimit !== null ? String(limit.bindingLimit) : '',
    );
    setSaveError(null);
    if (loadError) void load();
  };
  const close = () => {
    if (!saving) setAnchor(null);
  };

  const save = async (next: number | null) => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await client.setBindingRevisionHistoryLimit(
        entity,
        kind,
        bindingName,
        next,
      );
      setLimit(result);
      setAnchor(null);
      onChanged(result);
    } catch (e) {
      setSaveError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const parsed = parseHistoryLimit(text);
  const invalid = text.trim() !== '' && parsed === null;
  const unchanged = limit !== null && parsed === limit.bindingLimit;
  const removed = parsed !== null ? Math.max(oldRevisionCount - parsed, 0) : 0;
  const onReset =
    limit && limit.bindingLimit !== null
      ? resetWarning(limit, oldRevisionCount, environmentName)
      : null;

  return (
    <>
      <Tooltip
        title={
          canUpdate
            ? `Old revisions kept for rolling ${environmentName} back`
            : deniedTooltip
        }
      >
        <span>
          <Button
            onClick={open}
            disabled={!canUpdate}
            aria-haspopup="dialog"
            data-testid="revision-history-limit-button"
          >
            {historyLimitLabel(limit)}
          </Button>
        </span>
      </Tooltip>

      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          role: 'dialog',
          'aria-label': 'Revision history limit',
        }}
      >
        <Box className={classes.popover}>
          <Typography variant="subtitle2">Revision history limit</Typography>
          <Typography className={classes.note}>
            How many old revisions {environmentName} keeps to roll back to. The
            active revision is always kept. Changing the limit does not create a
            revision.
          </Typography>

          {!limit && !loadError && (
            <Box className={classes.loading}>
              <CircularProgress size={14} />
              <Typography className={classes.note}>
                Loading the current limit…
              </Typography>
            </Box>
          )}

          {loadError && (
            <Typography variant="body2" color="error">
              Could not load the limit: {loadError}
            </Typography>
          )}

          {limit && (
            <>
              <TextField
                className={classes.field}
                size="small"
                variant="outlined"
                type="number"
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={saving}
                error={invalid}
                placeholder={(() => {
                  if (limit.environmentLimitUnreadable) return 'Inherited';
                  return limit.environmentLimit !== null
                    ? String(limit.environmentLimit)
                    : 'Default';
                })()}
                inputProps={{
                  min: 0,
                  max: MAX_REVISION_HISTORY_LIMIT,
                  step: 1,
                  'aria-label': 'Revision history limit',
                }}
              />

              {invalid && (
                <Typography variant="caption" color="error">
                  Enter a whole number from 0 to {MAX_REVISION_HISTORY_LIMIT}.
                </Typography>
              )}

              {limit.bindingLimit === null ? (
                <Typography className={classes.note}>
                  Not set for this binding: it uses {inheritedLimitText(limit)}.
                </Typography>
              ) : (
                <Typography className={classes.note}>
                  Set for this binding. Reset it to use{' '}
                  {inheritedLimitText(limit)}.
                </Typography>
              )}

              {parsed === 0 && (
                <Typography
                  className={classes.warning}
                  data-testid="history-limit-warning"
                >
                  With a limit of 0 no old revision is kept, so{' '}
                  {environmentName} cannot be rolled back.
                </Typography>
              )}
              {parsed !== null && parsed > 0 && removed > 0 && (
                <Typography
                  className={classes.warning}
                  data-testid="history-limit-warning"
                >
                  Saving deletes up to {removed} of the oldest{' '}
                  {removed === 1 ? 'revision' : 'revisions'}. They cannot be
                  restored.
                </Typography>
              )}

              {onReset && (
                <Typography
                  className={classes.warning}
                  data-testid="history-limit-reset-warning"
                >
                  {onReset}
                </Typography>
              )}

              {saveError && (
                <Typography variant="body2" color="error">
                  Could not save the limit: {saveError}
                </Typography>
              )}
            </>
          )}

          <Box className={classes.actions}>
            {limit && limit.bindingLimit !== null && (
              <Button size="small" disabled={saving} onClick={() => save(null)}>
                Reset
              </Button>
            )}
            <Box className={classes.actionsEnd}>
              <Button size="small" disabled={saving} onClick={close}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                color="primary"
                disabled={!limit || saving || parsed === null || unchanged}
                onClick={() => parsed !== null && save(parsed)}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
};
