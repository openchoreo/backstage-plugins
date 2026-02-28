import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  makeStyles,
  CircularProgress,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.2s ease',
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
  },
  cardContent: {
    flexGrow: 1,
    padding: theme.spacing(1.5),
    paddingBottom: theme.spacing(0.5),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.25),
  },
  displayName: {
    fontWeight: 500,
    fontSize: '0.9375rem',
  },
  kindBadge: {
    marginLeft: theme.spacing(1),
    height: 20,
  },
  badge: {
    marginLeft: theme.spacing(1),
    height: 20,
  },
  traitName: {
    marginBottom: theme.spacing(0.5),
  },
  description: {
    color: theme.palette.text.secondary,
    fontSize: '0.8125rem',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  actions: {
    padding: theme.spacing(0.5, 1.5, 1.5),
  },
  addButton: {
    textTransform: 'none',
  },
}));

export interface TraitListItem {
  name: string;
  displayName?: string;
  description?: string;
  createdAt: string;
  kind?: 'Trait' | 'ClusterTrait';
}

interface TraitCardProps {
  trait: TraitListItem;
  addedCount: number;
  onAdd: () => void;
  loading?: boolean;
}

export const TraitCard = ({
  trait,
  addedCount,
  onAdd,
  loading = false,
}: TraitCardProps) => {
  const classes = useStyles();

  const displayTitle = trait.displayName || trait.name;
  const kindLabel = trait.kind === 'ClusterTrait' ? 'Cluster' : 'Namespace';

  return (
    <Card variant="outlined" className={classes.card}>
      <CardContent className={classes.cardContent}>
        <Box className={classes.header}>
          <Typography variant="subtitle1" className={classes.displayName}>
            {displayTitle}
          </Typography>
          <Box display="flex" alignItems="center">
            <Chip
              label={kindLabel}
              size="small"
              className={classes.kindBadge}
            />
            {addedCount > 0 && (
              <Chip
                label={`Added (${addedCount})`}
                size="small"
                color="primary"
                className={classes.badge}
              />
            )}
          </Box>
        </Box>
        {trait.displayName && (
          <Typography
            variant="caption"
            color="textSecondary"
            className={classes.traitName}
          >
            {trait.name}
          </Typography>
        )}
        <Typography variant="body2" className={classes.description}>
          {trait.description || 'No description available'}
        </Typography>
      </CardContent>
      <CardActions className={classes.actions}>
        <Button
          size="small"
          color="primary"
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
          onClick={onAdd}
          disabled={loading}
          className={classes.addButton}
          fullWidth
        >
          {loading ? 'Adding...' : 'Add Trait'}
        </Button>
      </CardActions>
    </Card>
  );
};
