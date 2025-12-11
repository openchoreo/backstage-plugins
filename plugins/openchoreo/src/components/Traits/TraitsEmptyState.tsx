import { Box, Typography, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import ExtensionIcon from '@material-ui/icons/Extension';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(8, 2),
    textAlign: 'center',
  },
  icon: {
    fontSize: 80,
    color: theme.palette.text.disabled,
    marginBottom: theme.spacing(2),
  },
  title: {
    marginBottom: theme.spacing(1),
    fontWeight: 500,
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
    maxWidth: 500,
  },
}));

interface TraitsEmptyStateProps {
  onAddTrait: () => void;
}

export const TraitsEmptyState: React.FC<TraitsEmptyStateProps> = ({
  onAddTrait,
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.container}>
      <ExtensionIcon className={classes.icon} />
      <Typography variant="h6" className={classes.title}>
        No traits attached yet
      </Typography>
      <Typography variant="body2" className={classes.description}>
        Traits represent cross-cutting concerns that add capabilities like
        persistent storage, observability, security policies, or service mesh
        integration without modifying your component definition.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={onAddTrait}
      >
        Add Trait
      </Button>
    </Box>
  );
};
