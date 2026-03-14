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

export const QuickActionsSection: React.FC = () => {
  const classes = useStyles();
  const { canCreate, loading: createPermLoading } =
    useComponentCreatePermission();

  const quickActions = [
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

  return (
    <Box className={classes.overviewSection}>
      <Typography variant="h3">Quick Actions</Typography>
      <Grid container spacing={2} className={classes.quickActionsContainer}>
        {quickActions.map((action, index) => (
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
