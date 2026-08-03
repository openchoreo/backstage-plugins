import { Box, makeStyles } from '@material-ui/core';
import { Typography } from '@material-ui/core';
import { OpenChoreoIcon } from '@openchoreo/backstage-design-system';
import { brandName, useBranding } from '../../branding';

const useStyles = makeStyles(theme => ({
  logoText: {
    color: theme.palette.grey[800],
  },
}));

const LogoFull = () => {
  const classes = useStyles();
  const branding = useBranding();

  if (branding.fullLogo) {
    return (
      <img
        src={branding.fullLogo}
        alt={brandName(branding)}
        style={{ maxHeight: 32, maxWidth: 180, objectFit: 'contain' }}
      />
    );
  }

  return (
    <Box display="flex" alignItems="center" gridGap={8}>
      <OpenChoreoIcon />
      <Typography variant="h3" className={classes.logoText} color="secondary">
        {brandName(branding)}
      </Typography>
    </Box>
  );
};

export default LogoFull;
