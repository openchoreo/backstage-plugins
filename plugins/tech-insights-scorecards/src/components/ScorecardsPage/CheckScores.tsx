import { Fragment, useMemo, useState } from 'react';
import IconButton from '@material-ui/core/IconButton';
import LinearProgress from '@material-ui/core/LinearProgress';
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
import { checkSummaries, type CheckSummary } from '../../breakdown';
import type { RollupNode } from '../../rollup';
import { titleCase } from '../../kinds';
import { UNCATEGORIZED } from '../../scoring';
import { NotScoredChip, TierChip } from '../TierChip';
import { useEntityTabLink } from '../useEntityTabLink';

const useStyles = makeStyles(theme => ({
  selectable: { cursor: 'pointer' },
  passBar: { width: 120 },
  check: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
}));

function CheckEntities({ summary }: { summary: CheckSummary }) {
  const tabLink = useEntityTabLink();
  const rows = [
    ...summary.failing.map(node => ({ node, passed: false })),
    ...summary.passing.map(node => ({ node, passed: true })),
  ];
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>This Check</TableCell>
          <TableCell>Current Tier</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(({ node, passed }) => (
          <TableRow key={node.ref}>
            <TableCell>
              <Link to={tabLink(node.entity)}>
                <EntityDisplayName entityRef={node.entity} />
              </Link>
            </TableCell>
            <TableCell>
              <Typography
                variant="body2"
                color={passed ? 'textPrimary' : 'error'}
              >
                {passed ? 'Passing' : 'Failing'}
              </Typography>
            </TableCell>
            <TableCell>
              {node.scored ? <TierChip rank={node.rank} /> : <NotScoredChip />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface CheckScoresProps {
  nodes: RollupNode[];
  /** What `nodes` are, as a heading, such as "Components". */
  itemsLabel: string;
}

/**
 * Each check that ran against `nodes`, lowest tier first, with how many it
 * passed on. Selecting a check lists its results, failing first.
 */
export function CheckScores({ nodes, itemsLabel }: CheckScoresProps) {
  const classes = useStyles();
  const checks = useMemo(() => checkSummaries(nodes), [nodes]);
  const [selected, setSelected] = useState<string>();
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Check</TableCell>
          <TableCell>Category</TableCell>
          <TableCell>{titleCase(`${itemsLabel} passing`)}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {checks.map(summary => {
          const { id } = summary.check;
          const total = summary.passing.length + summary.failing.length;
          const percentage = Math.round((summary.passing.length / total) * 100);
          const isOpen = id === selected;
          return (
            <Fragment key={id}>
              <TableRow
                hover
                selected={isOpen}
                className={classes.selectable}
                onClick={() => setSelected(isOpen ? undefined : id)}
              >
                <TableCell>
                  <div className={classes.check}>
                    {/* The button is the keyboard control; the row is a
                        larger target for the pointer. */}
                    <IconButton
                      size="small"
                      aria-label={`${
                        isOpen ? 'Hide' : 'Show'
                      } ${itemsLabel} for ${summary.check.name}`}
                      aria-expanded={isOpen}
                      onClick={event => {
                        event.stopPropagation();
                        setSelected(isOpen ? undefined : id);
                      }}
                    >
                      {isOpen ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                    </IconButton>
                    <span>{summary.check.name}</span>
                    {summary.check.metadata?.rank !== undefined && (
                      <TierChip rank={summary.check.metadata.rank} />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {summary.check.metadata?.category || UNCATEGORIZED}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {summary.passing.length} of {total}
                  </Typography>
                  <LinearProgress
                    className={classes.passBar}
                    variant="determinate"
                    value={percentage}
                    aria-label={`${summary.check.name}: ${percentage}% passing`}
                  />
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <CheckEntities summary={summary} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
