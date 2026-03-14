import { Box, Grid } from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { useStyles } from './styles';

export const TemplateCardSkeleton = () => {
  const classes = useStyles();

  return (
    <Box
      className={`${classes.cardBase} ${classes.resourceCard} ${classes.skeletonCard}`}
    >
      <Skeleton variant="circle" width={36} height={36} />
      <Skeleton variant="text" width={100} style={{ marginTop: 12 }} />
      <Skeleton variant="text" width={160} style={{ marginTop: 4 }} />
    </Box>
  );
};

export const TemplateCardSkeletons = ({ count }: { count: number }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {skeletons.map(i => (
        <Grid item xs={12} sm={6} md={3} key={`skeleton-${i}`}>
          <TemplateCardSkeleton />
        </Grid>
      ))}
    </>
  );
};
