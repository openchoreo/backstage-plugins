import { makeStyles } from '@material-ui/core/styles';

const DRAWER_WIDTH = 440;

export const useStyles = makeStyles(theme => ({
  drawerPaper: {
    width: DRAWER_WIDTH,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerTitle: { fontWeight: 600 },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  message: {
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    maxWidth: '90%',
    wordBreak: 'break-word',
    '& p': { margin: 0 },
    '& pre': {
      margin: theme.spacing(0.5, 0),
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius,
      overflowX: 'auto',
    },
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: theme.palette.background.default,
  },
  toolStatus: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
  // Working indicator rendered at the bottom of the timeline while a
  // turn is in flight. The streaming loop now buffers ChatResponse
  // content until the very end of the turn (to avoid flashing the
  // model's early placeholder), which leaves the drawer visually
  // silent for 10–30 s. This indicator is the user-facing signal
  // that the agent is still working. We grow the dots sequentially
  // (``Thinking .`` → ``Thinking ..`` → ``Thinking ...``) using a
  // ``steps(3)`` width animation on an ``::after`` containing the
  // full ``...`` clipped by ``overflow: hidden``. Pure CSS, no
  // setInterval / requestAnimationFrame.
  workingIndicator: {
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 0.25),
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
  workingDotsLabel: {
    // The dots themselves: ``::after`` carries the full literal
    // "..." but is clipped via ``width: 0`` initially. The animation
    // steps the width from 0 → 1.2em in 3 discrete jumps so each
    // tick reveals one more dot.
    display: 'inline-block',
    '&::after': {
      content: '"..."',
      display: 'inline-block',
      verticalAlign: 'bottom',
      overflow: 'hidden',
      width: 0,
      animation: '$workingDotsGrow steps(4, end) 1.4s infinite',
      whiteSpace: 'nowrap',
    },
  },
  '@keyframes workingDotsGrow': {
    to: { width: '1.2em' },
  },
  errorMsg: {
    alignSelf: 'stretch',
    color: theme.palette.error.main,
    fontSize: 12,
  },
  composer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  emptyState: {
    margin: 'auto',
    color: theme.palette.text.secondary,
    textAlign: 'center',
    padding: theme.spacing(3),
  },
  // Pill-strip of suggestion chips shown only on the empty timeline.
  // Vanishes once the user sends the first turn — the goal is to
  // bootstrap a conversation without occupying space afterwards.
  suggestionStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(2),
  },
  suggestionChip: {
    // Chips already have a clickable affordance via the variant; this
    // just bumps line-height for multi-line wrapping and gives a subtle
    // hover affordance distinct from the plain default.
    height: 'auto',
    padding: theme.spacing(0.5, 0),
    cursor: 'pointer',
    '& .MuiChip-label': {
      whiteSpace: 'normal',
      paddingTop: theme.spacing(0.25),
      paddingBottom: theme.spacing(0.25),
    },
  },
}));
