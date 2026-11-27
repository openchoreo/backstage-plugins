import { Fragment, type ReactNode } from 'react';
import { alpha, makeStyles } from '@material-ui/core/styles';

/**
 * The look shared by the agent's cards in the drawer — the change card of
 * an edit question and the save card — so they read as one family.
 */
export const useCardStyles = makeStyles(theme => ({
  card: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius * 2,
    overflow: 'hidden',
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
  },
  head: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    alignItems: 'center',
    columnGap: theme.spacing(1.25),
    padding: theme.spacing(1.25, 1.75),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  icon: {
    gridRow: 'span 2',
    display: 'grid',
    placeItems: 'center',
    width: 26,
    height: 26,
    borderRadius: 7,
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.14),
    '& svg': { fontSize: 16 },
  },
  title: {
    fontWeight: 600,
    lineHeight: 1.3,
    color: theme.palette.text.primary,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  summary: {
    color: theme.palette.text.primary,
    padding: theme.spacing(1.5, 1.75),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  question: { color: theme.palette.primary.main, fontWeight: 600 },
  // The question under the explanation and the rule, right above the options.
  askBelow: {
    padding: theme.spacing(1.5, 1.75, 0),
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: 'none',
  },
  section: {
    display: 'grid',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 1.75, 1.5),
    '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
  },
  // "Change" is what the user decides on: a light tint sets it apart.
  changeSection: { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  line: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
  },
  lineLabel: { color: theme.palette.text.secondary, minWidth: 0 },
  lineValue: {
    whiteSpace: 'nowrap',
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  // A test result's value: ticked or crossed, with what the rule wants.
  lineEnd: { display: 'grid', justifyItems: 'end', textAlign: 'right' },
  mark: { fontSize: 16, marginLeft: 4, verticalAlign: 'text-bottom' },
  pass: { color: theme.palette.success.main },
  fail: { color: theme.palette.error.main },
  changeLabel: { fontWeight: 500, color: theme.palette.text.primary },
  change: { display: 'grid', gap: theme.spacing(0.75) },
  values: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
  chip: {
    fontSize: theme.typography.body2.fontSize,
    lineHeight: 1.6,
    padding: theme.spacing(0, 1.25),
    borderRadius: 999,
    border: `1px solid ${theme.palette.divider}`,
    whiteSpace: 'nowrap',
  },
  before: {
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.1),
    borderColor: 'transparent',
    textDecoration: 'line-through',
  },
  after: {
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
    borderColor: alpha(theme.palette.primary.main, 0.5),
    fontWeight: 600,
  },
  pick: {
    color: theme.palette.primary.main,
    borderStyle: 'dashed',
    borderColor: alpha(theme.palette.primary.main, 0.5),
  },
  tag: {
    fontSize: 11,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 1.75),
    borderTop: `1px solid ${theme.palette.divider}`,
    '$askBelow + &': { borderTop: 'none' },
  },
  option: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.875),
    padding: theme.spacing(0.625, 1.5, 0.625, 0.75),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.6)}`,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.text.primary,
    '& .MuiTypography-root': { fontWeight: 600 },
    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '&.Mui-disabled': { opacity: 0.5 },
  },
  badge: {
    display: 'grid',
    placeItems: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    fontSize: 11,
    fontWeight: 600,
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.14),
  },
}));

// Explicit colours: the theme's contained button puts white text on a light
// primary in the dark theme, which is hard to read.
export const useButtonStyles = makeStyles(theme => ({
  button: { textTransform: 'none', fontWeight: 500 },
  primary: {
    fontWeight: 600,
    color: theme.palette.getContrastText(theme.palette.primary.main),
    backgroundColor: theme.palette.primary.main,
    '&:hover': { backgroundColor: theme.palette.primary.dark },
  },
  outlined: {
    color: theme.palette.text.primary,
    borderColor: alpha(theme.palette.text.primary, 0.35),
  },
  borderless: { color: theme.palette.text.secondary },
}));

export type ChildRef = string | { id: string; basePath: string };

/** Renders an A2UI child list. */
export const children = (
  refs: ChildRef[] | undefined,
  buildChild: (id: string, basePath?: string) => ReactNode,
) =>
  (refs ?? []).map(ref => {
    const id = typeof ref === 'string' ? ref : ref.id;
    const basePath = typeof ref === 'string' ? undefined : ref.basePath;
    return <Fragment key={id}>{buildChild(id, basePath)}</Fragment>;
  });
