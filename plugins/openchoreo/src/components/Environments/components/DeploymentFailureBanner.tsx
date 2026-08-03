import { useState } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import { DeploymentErrorDetailsDialog } from './DeploymentErrorDetailsDialog';

/** Messages longer than this get clamped with a "View details" affordance.
 *  Short controller errors render in full — no redundant trigger. */
const TRUNCATE_THRESHOLD = 120;

const useStyles = makeStyles(theme => ({
  banner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    backgroundColor: theme.palette.error.light,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.25, 1.5),
  },
  icon: {
    color: theme.palette.error.dark,
    fontSize: '1.2rem',
    marginTop: 1,
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
    flex: 1,
  },
  message: {
    color: theme.palette.error.dark,
    fontSize: '0.875rem',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  // Clamp to two lines so a long CEL dump doesn't blow out the panel height.
  messageClamped: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  reason: {
    color: theme.palette.error.dark,
    fontSize: '0.75rem',
    opacity: 0.85,
  },
  viewButton: {
    alignSelf: 'flex-start',
    padding: 0,
    minWidth: 0,
    color: theme.palette.error.dark,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'none',
    textDecoration: 'underline',
    lineHeight: 1.4,
    '&:hover': {
      backgroundColor: 'transparent',
      textDecoration: 'underline',
    },
  },
}));

export interface DeploymentFailureBannerProps {
  /** The controller's human-readable failure message (Ready condition message). */
  message?: string;
  /** Machine-readable reason, e.g. `RenderingFailed` / `AutoDeployFailed`. */
  reason?: string;
  /**
   * When true, the failure is attributed to the project not being deployed in
   * this environment. Prepends a plain-language lead line and threads the
   * remediation into the details dialog. `envName` / `envResourceName` feed
   * the "deploy the project" deep link.
   */
  projectNotDeployed?: boolean;
  envName?: string;
  envResourceName?: string;
}

/**
 * Error banner shown in the deploy detail panel and the Setup card when the
 * OpenChoreo controller could not roll out a release — either a post-binding
 * render/apply failure (from `ReleaseBinding.status.conditions`) or a
 * pre-binding auto-deploy failure (from `Component.status.conditions`).
 *
 * Mirrors {@link IncidentsBanner} but is error-styled. Controller messages can
 * be very long (a `RenderingFailed` embeds the whole CEL expression), so the
 * message is clamped to two lines and a prominent "View details" link opens
 * {@link DeploymentErrorDetailsDialog} with the full reason + message.
 */
export const DeploymentFailureBanner = ({
  message,
  reason,
  projectNotDeployed,
  envName,
  envResourceName,
}: DeploymentFailureBannerProps) => {
  const classes = useStyles();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Nothing actionable to show — don't render an empty red box.
  if (!message && !reason) return null;

  const headline = message || 'The controller could not roll out this release.';
  // Offer the dialog when the message is long enough to be clipped — short
  // messages render in full with the reason inline (no redundant trigger).
  const showViewDetails = (message?.length ?? 0) > TRUNCATE_THRESHOLD;

  return (
    <Box className={classes.banner} role="alert">
      <ReportProblemOutlinedIcon className={classes.icon} />
      <Box className={classes.body}>
        {projectNotDeployed && (
          <Typography className={classes.message} style={{ fontWeight: 600 }}>
            The project isn't deployed to this environment.
          </Typography>
        )}
        <Typography
          className={`${classes.message}${
            showViewDetails ? ` ${classes.messageClamped}` : ''
          }`}
        >
          {headline}
        </Typography>
        {reason && !showViewDetails && (
          <Typography className={classes.reason}>Reason: {reason}</Typography>
        )}
        {showViewDetails && (
          <Button
            className={classes.viewButton}
            size="small"
            variant="text"
            disableRipple
            onClick={() => setDetailsOpen(true)}
          >
            View details
          </Button>
        )}
      </Box>
      <DeploymentErrorDetailsDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        reason={reason}
        message={message}
        projectNotDeployed={projectNotDeployed}
        envName={envName}
        envResourceName={envResourceName}
      />
    </Box>
  );
};
