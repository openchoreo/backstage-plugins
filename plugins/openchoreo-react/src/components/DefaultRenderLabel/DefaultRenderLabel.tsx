import { DependencyGraphTypes } from '@backstage/core-components';
import { makeStyles } from '@material-ui/core/styles';
import clsx from 'clsx';
import { EntityEdgeData } from '@backstage/plugin-catalog-graph';

const useStyles = makeStyles(
  theme => ({
    text: {
      fill: theme.palette.text.secondary,
      fontSize: '0.7rem',
    },
    secondary: {
      fill: theme.palette.text.disabled,
    },
  }),
  { name: 'OpenChoreoGraphLabel' },
);

export function DefaultRenderLabel({
  edge: { relations },
}: DependencyGraphTypes.RenderLabelProps<EntityEdgeData>) {
  const classes = useStyles();
  return (
    <text className={classes.text} textAnchor="middle">
      {relations.map((r, i) => (
        <tspan key={r} className={clsx(i % 2 !== 0 && classes.secondary)}>
          {i > 0 && <tspan> / </tspan>}
          {r}
        </tspan>
      ))}
    </text>
  );
}
