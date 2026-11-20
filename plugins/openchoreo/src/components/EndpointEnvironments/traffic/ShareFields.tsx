import { useEffect, useRef } from 'react';
import {
  Box,
  InputAdornment,
  Slider,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import type {
  EndpointSplit,
  EndpointTrafficBackend,
} from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
    padding: theme.spacing(0.5, 1),
    margin: theme.spacing(0, -1),
    borderRadius: 8,
  },
  highlight: {
    backgroundColor: theme.palette.action.hover,
  },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  name: { flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column' },
  field: { width: 112 },
  slider: { flex: 2, minWidth: 140, margin: theme.spacing(0, 1) },
  was: { width: 64, fontVariantNumeric: 'tabular-nums' },
}));

/** Draft values as typed, by backend name. */
export type ShareDraft = Record<string, string>;

/** A draft as numbers; an empty field is NaN, so a split check refuses it. */
export const draftSplit = (draft: ShareDraft): EndpointSplit =>
  Object.fromEntries(
    Object.entries(draft).map(([k, v]) => [
      k,
      v.trim() === '' ? NaN : Number(v),
    ]),
  );

/** A split as a draft. */
export const toDraft = (split: EndpointSplit): ShareDraft =>
  Object.fromEntries(Object.entries(split).map(([k, v]) => [k, String(v)]));

/**
 * One row per backend: its colour, name, a slider and a percentage field,
 * with the value it had before when it changed.
 */
export const ShareFields = ({
  backends,
  draft,
  initial,
  onChange,
  colors,
  label = 'Share',
  focus,
  highlight,
  disabled,
}: {
  backends: EndpointTrafficBackend[];
  draft: ShareDraft;
  /** Values before editing; absent for a backend that is new. */
  initial: EndpointSplit;
  onChange: (draft: ShareDraft) => void;
  colors: Map<string, string>;
  label?: string;
  /** The backend whose field gets focus. */
  focus?: string;
  /** The backend this page is about. */
  highlight?: string;
  disabled?: boolean;
}) => {
  const classes = useStyles();
  const focusRef = useRef<HTMLInputElement>(null);
  useEffect(() => focusRef.current?.focus(), []);
  const split = draftSplit(draft);
  const set = (name: string, value: string) =>
    onChange({ ...draft, [name]: value });
  return (
    <>
      {backends.map(b => {
        const before = initial[b.name];
        let was = '';
        if (before === undefined) was = 'new';
        else if (split[b.name] !== before) was = `was ${before}%`;
        return (
          <Box
            key={b.name}
            className={clsx(
              classes.row,
              b.name === highlight && classes.highlight,
            )}
          >
            <span
              className={classes.dot}
              style={{ backgroundColor: colors.get(b.name) }}
            />
            <Box className={classes.name}>
              <Typography variant="body2" style={{ fontWeight: 500 }}>
                {b.name}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {b.componentName}
                {b.releaseLine ? ` @ ${b.releaseLine}` : ''} / {b.endpoint}
              </Typography>
            </Box>
            <Slider
              className={classes.slider}
              style={{ color: colors.get(b.name) }}
              value={Number(draft[b.name]) || 0}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              onChange={(_e, v) => set(b.name, String(v as number))}
              aria-label={`${label} slider for ${b.name}`}
            />
            <Typography
              variant="caption"
              color="textSecondary"
              className={classes.was}
            >
              {was}
            </Typography>
            <TextField
              id={`split-${b.name}`}
              className={classes.field}
              variant="outlined"
              size="small"
              label={label}
              type="number"
              value={draft[b.name] ?? ''}
              onChange={e => set(b.name, e.target.value)}
              inputProps={{
                min: 0,
                max: 100,
                step: 1,
                'aria-label': `${label} for ${b.name}`,
              }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              disabled={disabled}
              inputRef={b.name === focus ? focusRef : undefined}
              onFocus={e => e.target.select()}
            />
          </Box>
        );
      })}
    </>
  );
};
