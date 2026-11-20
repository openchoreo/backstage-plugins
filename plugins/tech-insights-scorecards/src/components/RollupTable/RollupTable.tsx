import { Fragment, useState, type MouseEvent } from 'react';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import IconButton from '@material-ui/core/IconButton';
import MuiLink from '@material-ui/core/Link';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Link } from '@backstage/core-components';
import { EntityDisplayName } from '@backstage/plugin-catalog-react';
import {
  countOf,
  inSentence,
  pluralOf,
  useEntityLabel,
  useKindLabel,
} from '../../utils/kinds';
import type { RollupNode } from '../../utils/rollup';
import { progressOf, rankOf } from '../../utils/scoring';
import { isKind, useVariantConfig } from '../../utils/variants';
import { useEntityTabLink } from '../../hooks';
import { NotScoredChip, TierChip } from '../TierChip';
import { TierLadder } from '../TierLadder';

// Fixed widths, so that expanding a row doesn't make the browser share the
// columns out again around the rows it reveals. Name takes what's left.
const useStyles = makeStyles({
  table: { tableLayout: 'fixed' },
  name: { overflowWrap: 'anywhere' },
  kindColumn: { width: '15%' },
  tierColumn: { width: 140 },
  checksColumn: { width: 150 },
  ladderColumn: { width: '36%' },
  expandableRow: { cursor: 'pointer' },
});

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

/** Variants are left out, since they're listed whether scored or not. */
function hasUnscored(nodes: RollupNode[]): boolean {
  return nodes.some(node => !node.scored || hasUnscored(node.children));
}

/**
 * A parent of variants as its main variant, scored on its own checks only.
 * For a parent without children, such as a component, that's the parent's
 * own tier and progress.
 */
function mainVariantOf(node: RollupNode): RollupNode {
  return {
    ...node,
    children: [],
    variants: [],
    checks: node.ownChecks,
    rank: rankOf(node.ownChecks),
    progress: progressOf(node.ownChecks),
    scored: node.ownChecks.length > 0,
    descendantCount: 0,
  };
}

/**
 * Marks a parent whose tier and checks cover only itself, beside its
 * variants: "main", next to a component that has release lines.
 */
export function MainChip() {
  const variants = useVariantConfig();
  const kindLabel = useKindLabel();
  if (!variants) return null;
  return (
    <Tooltip
      title={`Tier and checks cover the ${variants.mainLabel} ${inSentence(
        kindLabel(variants.kind),
      )} only.`}
    >
      <Chip label={variants.mainLabel} size="small" variant="outlined" />
    </Tooltip>
  );
}

export interface RollupTableProps {
  /** Rows, in the order given. */
  nodes: RollupNode[];
  showKind?: boolean;
  /** Rows expand to the entities in them. Defaults to true. */
  expandable?: boolean;
  /**
   * `toggle` (default) hides entities no check covers behind a link; `show`
   * lists them.
   */
  unscored?: 'toggle' | 'show';
  /** Adds each row's checks passing per tier. */
  showTierProgress?: boolean;
}

/**
 * Entities with their tier and checks passing, each expanding to the
 * entities that belong to it when clicked. A row's tier and checks combine everything
 * beneath it; its own checks are shown under them when it has both.
 * A row with variants, such as a component with release lines, counts them
 * under its name, the main one included, and expands to all of them after
 * its children: the main one first, carrying the row's own score and tab,
 * then the others, each named without its parent's prefix. While it's
 * expanded, a row with no children leaves its score to the main one. Entities no
 * check covers are hidden until asked for, unless `unscored` is `show`.
 * Variants are always listed, so the rows match the count.
 */
export function RollupTable({
  nodes,
  showKind = true,
  expandable = true,
  unscored = 'toggle',
  showTierProgress = false,
}: RollupTableProps) {
  const classes = useStyles();
  const kindLabel = useKindLabel();
  const entityLabel = useEntityLabel();
  const tabLink = useEntityTabLink();
  const variantConfig = useVariantConfig();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const showUnscored = unscored === 'show' || revealed;
  const unscoredCount = nodes.filter(node => !node.scored).length;
  const anyUnscored = expandable ? hasUnscored(nodes) : unscoredCount > 0;

  const visible = (list: RollupNode[]) =>
    showUnscored ? list : list.filter(node => node.scored);

  function toggle(path: string) {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function scoreCells(node: RollupNode, kind: string, blank = false) {
    const own = progressOf(node.ownChecks);
    if (blank) {
      return (
        <>
          {showKind && <TableCell>{kindLabel(kind)}</TableCell>}
          <TableCell />
          <TableCell />
          {showTierProgress && <TableCell />}
        </>
      );
    }
    return (
      <>
        {showKind && <TableCell>{kindLabel(kind)}</TableCell>}
        <TableCell>
          {node.scored ? <TierChip rank={node.rank} /> : <NotScoredChip />}
        </TableCell>
        <TableCell>
          {node.scored ? (
            <>
              {node.progress.passedChecks}/{node.progress.totalChecks} (
              {node.progress.percentage}%)
              {node.descendantCount > 0 && own.totalChecks > 0 && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  display="block"
                >
                  Own checks: {own.passedChecks}/{own.totalChecks}
                </Typography>
              )}
            </>
          ) : (
            '—'
          )}
        </TableCell>
        {showTierProgress && (
          <TableCell>
            {node.scored ? <TierLadder checks={node.checks} /> : '—'}
          </TableCell>
        )}
      </>
    );
  }

  function renderMainRow(
    parent: RollupNode,
    depth: number,
    parentPath: string,
  ) {
    if (!variantConfig) return null;
    const main = mainVariantOf(parent);
    return (
      <TableRow key={`${parentPath}#main`} hover>
        <TableCell className={classes.name}>
          <Box display="flex" alignItems="center" pl={depth * 3}>
            <Box width={30} flexShrink={0} />
            <Box>
              <Link to={tabLink(parent.entity, { toTab: main.scored })}>
                {variantConfig.mainLabel}
              </Link>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
              >
                {`Sets the ${inSentence(
                  kindLabel(variantConfig.parentKind),
                )}'s tier`}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        {scoreCells(main, variantConfig.kind)}
      </TableRow>
    );
  }

  function renderRows(list: RollupNode[], depth: number, parentPath: string) {
    return list.map(node => {
      const path = `${parentPath}/${node.ref}`;
      const children = expandable ? visible(node.children) : [];
      const variants = expandable ? node.variants : [];
      const isOpen = expanded.has(path);
      const canOpen = children.length > 0 || variants.length > 0;
      const isVariant =
        !!variantConfig && isKind(node.entity.kind, variantConfig.kind);
      const variantLabel =
        variantConfig && node.variants.length > 0
          ? kindLabel(variantConfig.kind)
          : undefined;
      const scoreOnMainRow =
        isOpen && variants.length > 0 && node.descendantCount === 0;
      return (
        <Fragment key={path}>
          <TableRow
            hover
            className={canOpen ? classes.expandableRow : undefined}
            onClick={canOpen ? () => toggle(path) : undefined}
          >
            <TableCell className={classes.name}>
              <Box display="flex" alignItems="center" pl={depth * 3}>
                {canOpen ? (
                  <IconButton
                    size="small"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    aria-expanded={isOpen}
                    onClick={event => {
                      event.stopPropagation();
                      toggle(path);
                    }}
                  >
                    {isOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                  </IconButton>
                ) : (
                  expandable && <Box width={30} flexShrink={0} />
                )}
                <Box>
                  <Link
                    to={tabLink(node.entity, { toTab: node.scored })}
                    onClick={stopPropagation}
                  >
                    {isVariant ? (
                      node.entity.metadata.name
                    ) : (
                      <EntityDisplayName entityRef={node.entity} />
                    )}
                  </Link>
                  {variantLabel && (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      {countOf(
                        node.variants.length + 1,
                        inSentence(variantLabel),
                        inSentence(pluralOf(variantLabel)),
                      )}
                    </Typography>
                  )}
                </Box>
              </Box>
            </TableCell>
            {scoreCells(node, node.entity.kind, scoreOnMainRow)}
          </TableRow>
          {isOpen && renderRows(children, depth + 1, path)}
          {isOpen &&
            variants.length > 0 &&
            renderMainRow(node, depth + 1, path)}
          {isOpen && renderRows(variants, depth + 1, path)}
        </Fragment>
      );
    });
  }

  return (
    <>
      <Table size="small" className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            {showKind && (
              <TableCell className={classes.kindColumn}>Kind</TableCell>
            )}
            <TableCell className={classes.tierColumn}>Current Tier</TableCell>
            <TableCell className={classes.checksColumn}>
              Checks Passing
            </TableCell>
            {showTierProgress && (
              <TableCell className={classes.ladderColumn}>
                Passing by Tier
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>{renderRows(visible(nodes), 0, '')}</TableBody>
      </Table>
      {anyUnscored && unscored === 'toggle' && (
        <Box mt={1}>
          <MuiLink
            component="button"
            variant="body2"
            onClick={() => setRevealed(!revealed)}
          >
            {showUnscored
              ? `Hide ${entityLabel.plural} not scored`
              : `Show ${entityLabel.plural} not scored${
                  unscoredCount ? ` (${unscoredCount})` : ''
                }`}
          </MuiLink>
        </Box>
      )}
    </>
  );
}
