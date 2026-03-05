import { FormControl, Select, MenuItem } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PublicIcon from '@material-ui/icons/Public';
import FolderIcon from '@material-ui/icons/Folder';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE, BindingScope } from './constants';

const useStyles = makeStyles(theme => ({
  formControl: {
    minWidth: 200,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& .MuiSvgIcon-root': {
      fontSize: '1.2rem',
    },
  },
}));

interface ScopeDropdownProps {
  value: BindingScope;
  onChange: (scope: BindingScope) => void;
  clusterLabel?: string;
  namespaceLabel?: string;
}

export const ScopeDropdown = ({
  value,
  onChange,
  clusterLabel = 'Cluster',
  namespaceLabel = 'Namespace',
}: ScopeDropdownProps) => {
  const classes = useStyles();

  return (
    <FormControl
      variant="outlined"
      size="small"
      className={classes.formControl}
    >
      <Select
        value={value}
        onChange={e => onChange(e.target.value as BindingScope)}
      >
        <MenuItem value={SCOPE_CLUSTER}>
          <span className={classes.menuItem}>
            <PublicIcon /> {clusterLabel}
          </span>
        </MenuItem>
        <MenuItem value={SCOPE_NAMESPACE}>
          <span className={classes.menuItem}>
            <FolderIcon /> {namespaceLabel}
          </span>
        </MenuItem>
      </Select>
    </FormControl>
  );
};
