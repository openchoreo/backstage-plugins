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
    // Tight inner padding — each paragraph carries no top/bottom margin
    // by default so the message bubble doesn't bleed whitespace at
    // its edges. Inter-paragraph spacing is added via the adjacent-
    // sibling selector below so consecutive paragraphs breathe but
    // the first/last paragraphs stay flush with the bubble edge.
    // Important for the new section-labelled output where a
    // ``**Diagnosis**`` paragraph sits above the body paragraph: the
    // gap is what visually separates the label from its content.
    '& p': { margin: 0 },
    '& p + p': { marginTop: theme.spacing(0.75) },
    // Same treatment for lists / blockquotes following a paragraph —
    // the evidence bullets typically appear right after an
    // ``**Evidence**`` label paragraph, and need the same gap to
    // read as a separate section.
    '& p + ul, & p + ol, & p + blockquote': {
      marginTop: theme.spacing(0.75),
    },
    '& ul + p, & ol + p, & blockquote + p': {
      marginTop: theme.spacing(0.75),
    },
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
  // Native ``<details>`` block holding the evidence / trace-bridge
  // section of an assistant message. We default to closed (no ``open``
  // attribute on the element) so the diagnosis + next action are what
  // the user reads first. The ``▸ Show details`` affordance already
  // signals the expandable region; no border-left rail is needed and
  // the rail introduced a ~10 px offset that misaligned the expanded
  // content with the surrounding message paragraphs.
  evidenceDetails: {
    marginTop: theme.spacing(0.75),
    // Children render with the same body-text styles as the rest of
    // the message; we just tighten paragraph spacing so the expanded
    // bullets don't blow up the drawer height when revealed.
    '& p': { margin: 0 },
    '& ul, & ol': {
      marginTop: theme.spacing(0.25),
      marginBottom: theme.spacing(0.25),
      paddingLeft: theme.spacing(2),
    },
  },
  evidenceSummary: {
    cursor: 'pointer',
    fontSize: 12,
    color: theme.palette.text.secondary,
    listStyle: 'none',
    // Hide the default disclosure triangle on browsers that show it
    // (Firefox); we provide our own via a ``>`` glyph below. WebKit
    // (Chrome/Safari) needs the vendor-prefixed pseudo-element form.
    '&::-webkit-details-marker': { display: 'none' },
    '&::marker': { display: 'none' },
    // Custom marker — rotates 90° when the parent <details> is open.
    '&::before': {
      content: '"▸"',
      display: 'inline-block',
      width: '1em',
      transition: 'transform 120ms ease',
    },
    '$evidenceDetails[open] > &::before': {
      transform: 'rotate(90deg)',
    },
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
}));
