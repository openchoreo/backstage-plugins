import { Fragment, useState, type MouseEvent } from 'react';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import MuiLink from '@material-ui/core/Link';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { Link } from '@backstage/core-components';
import { EntityDisplayName } from '@backstage/plugin-catalog-react';
import { useEntityLabel, useKindLabel } from '../../utils/kinds';
import type { RollupNode } from '../../utils/rollup';
import { progressOf } from '../../utils/scoring';
import { useEntityTabLink } from '../../hooks';
import { NotScoredChip, TierChip } from '../TierChip';
import { TierLadder } from '../TierLadder';

const useStyles = makeStyles({
  expandableRow: { cursor: 'pointer' },
});

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

function hasUnscored(nodes: RollupNode[]): boolean {
  return nodes.some(node => !node.scored || hasUnscored(node.children));
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
 * Entities no check covers are hidden until asked for, unless `unscored`
 * is `show`.
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

  function renderRows(list: RollupNode[], depth: number, parentPath: string) {
    return visible(list).map(node => {
      const path = `${parentPath}/${node.ref}`;
      const children = expandable ? visible(node.children) : [];
      const isOpen = expanded.has(path);
      const own = progressOf(node.ownChecks);
      const canOpen = children.length > 0;
      return (
        <Fragment key={path}>
          <TableRow
            hover
            className={canOpen ? classes.expandableRow : undefined}
            onClick={canOpen ? () => toggle(path) : undefined}
          >
            <TableCell>
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
                <Link
                  to={tabLink(node.entity, { toTab: node.scored })}
                  onClick={stopPropagation}
                >
                  <EntityDisplayName entityRef={node.entity} />
                </Link>
              </Box>
            </TableCell>
            {showKind && <TableCell>{kindLabel(node.entity.kind)}</TableCell>}
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
          </TableRow>
          {isOpen && renderRows(node.children, depth + 1, path)}
        </Fragment>
      );
    });
  }

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            {showKind && <TableCell>Kind</TableCell>}
            <TableCell>Current Tier</TableCell>
            <TableCell>Checks Passing</TableCell>
            {showTierProgress && <TableCell>Passing by Tier</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>{renderRows(nodes, 0, '')}</TableBody>
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
