import { useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Box,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useNamespaces } from '../hooks';

const useStyles = makeStyles(theme => ({
  formControl: {
    minWidth: 200,
  },
  loadingWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

interface NamespaceSelectorProps {
  value: string;
  onChange: (namespace: string) => void;
  label?: string;
  disabled?: boolean;
}

export const NamespaceSelector = ({
  value,
  onChange,
  label = 'Namespace',
  disabled = false,
}: NamespaceSelectorProps) => {
  const classes = useStyles();
  const { namespaces, loading } = useNamespaces();

  useEffect(() => {
    if (!loading && !value && namespaces.length > 0) {
      onChange(namespaces[0].name);
    }
  }, [loading, namespaces, value, onChange]);

  if (loading) {
    return (
      <Box className={classes.loadingWrapper}>
        <CircularProgress size={20} />
        <span>Loading namespaces...</span>
      </Box>
    );
  }

  return (
    <FormControl
      variant="outlined"
      size="small"
      className={classes.formControl}
      disabled={disabled}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={e => onChange(e.target.value as string)}
        label={label}
      >
        {namespaces.map(ns => (
          <MenuItem key={ns.name} value={ns.name}>
            {ns.displayName || ns.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
