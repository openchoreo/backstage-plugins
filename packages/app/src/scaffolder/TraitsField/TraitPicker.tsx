import { useMemo } from 'react';
import { Grid, Typography, Box, makeStyles } from '@material-ui/core';
import { TraitCard, TraitListItem } from './TraitCard';

const useStyles = makeStyles(theme => ({
  header: {
    marginBottom: theme.spacing(2),
  },
  description: {
    marginBottom: theme.spacing(2),
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

interface TraitPickerProps {
  availableTraits: TraitListItem[];
  addedTraitNames: string[];
  onAddTrait: (traitName: string) => void;
  loading?: boolean;
  loadingTraitName?: string;
}

export const TraitPicker = ({
  availableTraits,
  addedTraitNames,
  onAddTrait,
  loading = false,
  loadingTraitName,
}: TraitPickerProps) => {
  const classes = useStyles();

  // Count how many times each trait has been added
  const traitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    addedTraitNames.forEach(name => {
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [addedTraitNames]);

  if (availableTraits.length === 0 && !loading) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="body2">
          No traits available in this namespace.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="textSecondary" className={classes.description}>
        Enhance your component with optional capabilities. You can add the same trait multiple times with different configurations.
      </Typography>
      <Grid container spacing={2}>
        {availableTraits.map(trait => (
          <Grid item xs={12} sm={6} md={4} key={trait.name}>
            <TraitCard
              trait={trait}
              addedCount={traitCounts[trait.name] || 0}
              onAdd={() => onAddTrait(trait.name)}
              loading={loadingTraitName === trait.name}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
