import Box from '@material-ui/core/Box';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import { Link } from '@backstage/core-components';
import { useApp } from '@backstage/core-plugin-api';

export interface ReleaseLineNameCellProps {
  name: string;
  /** The line's page. */
  to: string;
}

/** A line's kind icon and name, as in the project's contents table. */
export function ReleaseLineNameCell({ name, to }: ReleaseLineNameCellProps) {
  const app = useApp();
  const Icon = app.getSystemIcon('kind:releaseline') ?? CallSplitIcon;

  return (
    <Box display="flex" alignItems="center" gridGap={6} minWidth={0}>
      <Icon fontSize="small" />
      <Link to={to}>{name}</Link>
    </Box>
  );
}
