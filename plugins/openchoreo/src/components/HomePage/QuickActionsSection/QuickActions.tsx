import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Tooltip,
  Typography,
} from '@material-ui/core';
import LaunchIcon from '@material-ui/icons/Launch';
import { Link } from 'react-router-dom';
import { useComponentCreatePermission } from '@openchoreo/backstage-plugin-react';
import { useStyles } from './styles';

interface QuickActionsSectionProps {
  /** Hide the "Quick Actions" heading when an outer frame owns the title. */
  hideTitle?: boolean;
}

interface QuickAction {
  title: string;
  description: string;
  link: string;
  disabled?: boolean;
  tooltip?: string;
}

const getQuickActions = (
  canCreate: boolean,
  createPermLoading: boolean,
): QuickAction[] => [
  {
    title: 'Create Component',
    description: 'Start a new service',
    link: '/create/templates/default/create-openchoreo-component',
    disabled: !canCreate && !createPermLoading,
    tooltip:
      !canCreate && !createPermLoading
        ? 'You do not have permission to create a component'
        : '',
  },
  {
    title: 'View My Projects',
    description: 'Manage your work',
    link: '/catalog?filters[kind]=System&filters[user]=owned',
  },
  {
    title: 'View My Components',
    description: 'View your components',
    link: '/catalog?filters[kind]=Component&filters[user]=owned',
  },
  {
    title: 'Browse Templates',
    description: 'Available Golden Paths',
    link: '/create',
  },
];

// Display only: takes the actions as props, so it can be shown without
// checking permissions.
const QuickActionsView = ({
  actions,
  hideTitle,
}: {
  actions: QuickAction[];
  hideTitle: boolean;
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.overviewSection}>
      {!hideTitle && <Typography variant="h3">Quick Actions</Typography>}
      <Grid container spacing={2} className={classes.quickActionsContainer}>
        {actions.map((action, index) => (
          <Grid item xs={12} sm={6} md={6} key={index}>
            <Tooltip title={action.tooltip ?? ''}>
              <Card
                className={classes.quickActionCard}
                style={action.disabled ? { opacity: 0.5 } : undefined}
              >
                <CardActionArea
                  className={classes.quickActionCardAction}
                  component={action.disabled ? 'div' : Link}
                  {...(action.disabled ? {} : { to: action.link })}
                  disabled={action.disabled}
                  disableRipple
                >
                  <CardContent className={classes.quickActionCardContent}>
                    <Box className={classes.quickActionHeader}>
                      <Typography
                        variant="h5"
                        className={classes.quickActionTitle}
                      >
                        {action.title}
                      </Typography>
                      <LaunchIcon
                        fontSize="small"
                        className={classes.quickActionIcon}
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      {action.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Tooltip>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export const QuickActionsSection = ({
  hideTitle = false,
}: QuickActionsSectionProps = {}) => {
  const { canCreate, loading: createPermLoading } =
    useComponentCreatePermission();

  return (
    <QuickActionsView
      actions={getQuickActions(canCreate, createPermLoading)}
      hideTitle={hideTitle}
    />
  );
};

// Static preview for the home page "Add widget" gallery. It never checks
// permissions or calls an API, so every action is shown as available.
export const QuickActionsSectionPreview = ({
  hideTitle = false,
}: QuickActionsSectionProps = {}) => (
  <QuickActionsView
    actions={getQuickActions(true, false)}
    hideTitle={hideTitle}
  />
);
