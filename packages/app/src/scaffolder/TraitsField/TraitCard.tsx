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
    paddingBottom: theme.spacing(1),
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.5),
  },
  displayName: {
    fontWeight: 500,
  },
  badge: {
    marginLeft: theme.spacing(1),
    height: 20,
  },
  traitName: {
    marginBottom: theme.spacing(1),
  },
  description: {
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  actions: {
    padding: theme.spacing(1, 2, 2),
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

  return (
    <Card variant="outlined" className={classes.card}>
      <CardContent className={classes.cardContent}>
        <Box className={classes.header}>
          <Typography variant="subtitle1" className={classes.displayName}>
            {displayTitle}
          </Typography>
          {addedCount > 0 && (
            <Chip
              label={`Added (${addedCount})`}
              size="small"
              color="primary"
              className={classes.badge}
            />
          )}
        </Box>
        {trait.displayName && (
          <Typography variant="caption" color="textSecondary" className={classes.traitName}>
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
