import { FC, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  FormHelperText,
  InputAdornment,
  MenuItem,
  MenuList,
  Popover,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import {
  KeyboardDatePicker,
  KeyboardTimePicker,
  MuiPickersUtilsProvider,
} from '@material-ui/pickers';
import DateFnsUtils from '@date-io/date-fns';
import { TIME_RANGE_OPTIONS } from '../../types';

const HOUR_MS = 60 * 60 * 1000;

const toDate = (iso?: string): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Replace just the date portion of `prev` with the date from `picked`,
// preserving the existing time-of-day.
const mergeDate = (prev: Date | null, picked: Date | null): Date | null => {
  if (!picked || Number.isNaN(picked.getTime())) return prev;
  const base = prev ? new Date(prev) : new Date(picked);
  base.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  return base;
};

const mergeTime = (prev: Date | null, picked: Date | null): Date | null => {
  if (!picked || Number.isNaN(picked.getTime())) return prev;
  const base = prev ? new Date(prev) : new Date(picked);
  base.setHours(picked.getHours(), picked.getMinutes(), picked.getSeconds(), 0);
  return base;
};

const formatCustomLabel = (start?: string, end?: string): string => {
  if (!start || !end) return 'Custom range';
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${fmt(start)} – ${fmt(end)}`;
};

const useStyles = makeStyles(theme => ({
  trigger: {
    cursor: 'pointer',
    '& input': { cursor: 'pointer' },
  },
  panel: {
    display: 'flex',
    flexDirection: 'row',
  },
  sidePanel: {
    padding: theme.spacing(2),
    width: 380,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  presetList: {
    minWidth: 200,
    padding: theme.spacing(1, 0),
  },
  panelTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  fieldLabel: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(0.5),
  },
  fieldRow: {
    display: 'flex',
    gap: theme.spacing(1),
    '& > *': { flex: 1 },
  },
  actions: {
    marginTop: theme.spacing(2),
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
  },
}));

export interface TimeRangeFilterProps {
  value: string;
  customStartTime?: string;
  customEndTime?: string;
  onChange: (next: {
    timeRange: string;
    customStartTime?: string;
    customEndTime?: string;
  }) => void;
  disabled?: boolean;
  fullWidth?: boolean;
}

export const TimeRangeFilter: FC<TimeRangeFilterProps> = ({
  value,
  customStartTime,
  customEndTime,
  onChange,
  disabled = false,
  fullWidth = true,
}) => {
  const classes = useStyles();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | null>(
    toDate(customStartTime),
  );
  const [draftEnd, setDraftEnd] = useState<Date | null>(toDate(customEndTime));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftStart(toDate(customStartTime));
    setDraftEnd(toDate(customEndTime));
  }, [customStartTime, customEndTime]);

  const openDropdown = () => {
    if (disabled) return;
    setShowCustomPanel(value === 'custom');
    if (!draftStart || !draftEnd) {
      const now = new Date();
      setDraftStart(prev => prev ?? new Date(now.getTime() - HOUR_MS));
      setDraftEnd(prev => prev ?? now);
    }
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const selectPreset = (preset: string) => {
    if (preset === 'custom') {
      setShowCustomPanel(true);
      return;
    }
    onChange({
      timeRange: preset,
      customStartTime: undefined,
      customEndTime: undefined,
    });
    close();
  };

  const handleApply = () => {
    if (!draftStart || !draftEnd) {
      setError('Select both a start and end time.');
      return;
    }
    if (draftEnd.getTime() <= draftStart.getTime()) {
      setError('End time must be after start time.');
      return;
    }
    onChange({
      timeRange: 'custom',
      customStartTime: draftStart.toISOString(),
      customEndTime: draftEnd.toISOString(),
    });
    close();
  };

  const triggerLabel =
    value === 'custom'
      ? formatCustomLabel(customStartTime, customEndTime)
      : TIME_RANGE_OPTIONS.find(o => o.value === value)?.label ?? '';

  return (
    <>
      <div ref={anchorRef}>
        <TextField
          fullWidth={fullWidth}
          disabled={disabled}
          variant="outlined"
          label="Time Range"
          value={triggerLabel}
          onClick={openDropdown}
          InputLabelProps={{ shrink: true }}
          InputProps={{
            readOnly: true,
            classes: { root: classes.trigger },
            endAdornment: (
              <InputAdornment position="end">
                <ArrowDropDownIcon />
              </InputAdornment>
            ),
          }}
        />
      </div>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        marginThreshold={8}
        PaperProps={{ elevation: 3, className: classes.panel }}
      >
        {showCustomPanel && (
          <Box className={classes.sidePanel}>
            <Typography variant="subtitle1" className={classes.panelTitle}>
              Select date and time range
            </Typography>
            <MuiPickersUtilsProvider utils={DateFnsUtils}>
              <Typography variant="body2" className={classes.fieldLabel}>
                Start from
              </Typography>
              <Box className={classes.fieldRow}>
                <KeyboardDatePicker
                  value={draftStart}
                  onChange={d => {
                    setDraftStart(prev => mergeDate(prev, d));
                    setError(null);
                  }}
                  format="dd MMM, yyyy"
                  inputVariant="outlined"
                  size="small"
                  variant="inline"
                  autoOk
                  maxDate={draftEnd || undefined}
                />
                <KeyboardTimePicker
                  value={draftStart}
                  onChange={d => {
                    setDraftStart(prev => mergeTime(prev, d));
                    setError(null);
                  }}
                  ampm={false}
                  views={['hours', 'minutes', 'seconds']}
                  format="HH:mm:ss"
                  inputVariant="outlined"
                  size="small"
                  variant="inline"
                  autoOk
                />
              </Box>
              <Typography variant="body2" className={classes.fieldLabel}>
                End on
              </Typography>
              <Box className={classes.fieldRow}>
                <KeyboardDatePicker
                  value={draftEnd}
                  onChange={d => {
                    setDraftEnd(prev => mergeDate(prev, d));
                    setError(null);
                  }}
                  format="dd MMM, yyyy"
                  inputVariant="outlined"
                  size="small"
                  variant="inline"
                  autoOk
                  minDate={draftStart || undefined}
                  disableFuture
                />
                <KeyboardTimePicker
                  value={draftEnd}
                  onChange={d => {
                    setDraftEnd(prev => mergeTime(prev, d));
                    setError(null);
                  }}
                  ampm={false}
                  views={['hours', 'minutes', 'seconds']}
                  format="HH:mm:ss"
                  inputVariant="outlined"
                  size="small"
                  variant="inline"
                  autoOk
                />
              </Box>
            </MuiPickersUtilsProvider>
            {error && <FormHelperText error>{error}</FormHelperText>}
            <Box className={classes.actions}>
              <Button onClick={close} size="small">
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                size="small"
                variant="contained"
                color="primary"
              >
                Apply
              </Button>
            </Box>
          </Box>
        )}
        <MenuList className={classes.presetList} disablePadding>
          {TIME_RANGE_OPTIONS.map(option => {
            const isCustomActive = option.value === 'custom' && showCustomPanel;
            return (
              <MenuItem
                key={option.value}
                selected={option.value === value || isCustomActive}
                onClick={() => selectPreset(option.value)}
              >
                {option.label}
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    </>
  );
};
