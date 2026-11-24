import type { ReactNode } from 'react';
import ButtonBase from '@material-ui/core/ButtonBase';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import { alpha, makeStyles } from '@material-ui/core/styles';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

const useStyles = makeStyles(theme => ({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.25),
    width: '100%',
    textAlign: 'left',
    padding: theme.spacing(0.875, 1.25),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.55)}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.text.primary,
    '& svg': { fontSize: 16, color: theme.palette.primary.main },
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  // The option picked: kept in view, ticked; the others step back.
  on: {
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
    '&.Mui-disabled': { color: theme.palette.text.primary },
  },
  off: { '&.Mui-disabled': { opacity: 0.5 } },
  text: { display: 'grid', gap: 2 },
  label: { fontWeight: 500 },
  description: { color: theme.palette.text.secondary },
  spinner: { color: theme.palette.primary.main, flex: '0 0 auto' },
}));

/**
 * One option of a card the user picks from — the level picker, a save
 * card's save choices: a label, a line on what it does, and an arrow. Once
 * picked it stays in view, highlighted with a tick (or a spinner while it
 * works), and the other options step back.
 */
export const OptionRow = ({
  label,
  description,
  selected = false,
  busy = false,
  disabled = false,
  onClick,
}: {
  label: ReactNode;
  description?: ReactNode;
  selected?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => {
  const classes = useStyles();
  let icon = <ArrowForwardIcon aria-hidden="true" />;
  if (busy) {
    icon = (
      <CircularProgress
        size={16}
        thickness={5}
        className={classes.spinner}
        aria-label="In progress"
      />
    );
  } else if (selected) {
    icon = <CheckCircleIcon aria-hidden="true" />;
  }
  return (
    <ButtonBase
      className={`${classes.row} ${selected ? classes.on : classes.off}`}
      disabled={disabled}
      aria-pressed={selected}
      // Named by its label alone; the line under it is shown, not read.
      aria-label={typeof label === 'string' ? label : undefined}
      onClick={onClick}
    >
      <span className={classes.text}>
        <Typography variant="body2" component="span" className={classes.label}>
          {label}
        </Typography>
        {description && (
          <Typography
            variant="caption"
            component="span"
            className={classes.description}
          >
            {description}
          </Typography>
        )}
      </span>
      {icon}
    </ButtonBase>
  );
};
