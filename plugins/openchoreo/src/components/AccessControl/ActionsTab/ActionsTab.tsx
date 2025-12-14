import { useState, useMemo } from 'react';
import {
  Typography,
  Box,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Collapse,
  IconButton,
  Paper,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import RefreshIcon from '@material-ui/icons/Refresh';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { useActions } from '../hooks';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(3),
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  searchField: {
    width: 300,
  },
  listContainer: {
    marginTop: theme.spacing(2),
  },
  groupHeader: {
    backgroundColor: theme.palette.background.default,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  groupTitle: {
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  actionItem: {
    paddingLeft: theme.spacing(4),
    borderLeft: `2px solid ${theme.palette.divider}`,
    marginLeft: theme.spacing(2),
  },
  actionText: {
    fontFamily: 'monospace',
    fontSize: '0.9rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
  },
  description: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

interface ActionGroup {
  resource: string;
  actions: string[];
}

export const ActionsTab = () => {
  const classes = useStyles();
  const { actions, loading, error, fetchActions } = useActions();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group actions by resource type
  const groupedActions = useMemo<ActionGroup[]>(() => {
    const groups: Record<string, string[]> = {};

    actions.forEach(action => {
      const [resource] = action.split(':');
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(action);
    });

    return Object.entries(groups)
      .map(([resource, resourceActions]) => ({
        resource,
        actions: resourceActions.sort(),
      }))
      .sort((a, b) => a.resource.localeCompare(b.resource));
  }, [actions]);

  // Filter based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedActions;

    const query = searchQuery.toLowerCase();
    return groupedActions
      .map(group => ({
        ...group,
        actions: group.actions.filter(action =>
          action.toLowerCase().includes(query),
        ),
      }))
      .filter(group => group.actions.length > 0);
  }, [groupedActions, searchQuery]);

  // Auto-expand groups when searching
  useMemo(() => {
    if (searchQuery) {
      setExpandedGroups(new Set(filteredGroups.map(g => g.resource)));
    }
  }, [searchQuery, filteredGroups]);

  const toggleGroup = (resource: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resource)) {
        newSet.delete(resource);
      } else {
        newSet.add(resource);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(groupedActions.map(g => g.resource)));
  };

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const totalActions = actions.length;
  const filteredCount = filteredGroups.reduce(
    (sum, g) => sum + g.actions.length,
    0,
  );

  return (
    <Box>
      <Box className={classes.header}>
        <Typography variant="h5">Available Actions</Typography>
        <IconButton onClick={fetchActions} size="small" title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      <Typography variant="body2" className={classes.description}>
        Actions represent permissions that can be assigned to roles. Each action
        follows the format <code>resource:operation</code>.
      </Typography>

      <Box className={classes.filterRow}>
        <TextField
          className={classes.searchField}
          placeholder="Filter actions..."
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="body2" color="textSecondary">
          {searchQuery
            ? `${filteredCount} of ${totalActions} actions`
            : `${totalActions} actions`}
        </Typography>
        {!searchQuery && (
          <Typography
            variant="body2"
            color="primary"
            style={{ cursor: 'pointer' }}
            onClick={expandAll}
          >
            Expand all
          </Typography>
        )}
      </Box>

      {filteredGroups.length === 0 ? (
        <Box className={classes.emptyState}>
          <Typography variant="body1" color="textSecondary">
            {searchQuery
              ? 'No actions match your search'
              : 'No actions available'}
          </Typography>
        </Box>
      ) : (
        <Paper className={classes.listContainer}>
          <List disablePadding>
            {filteredGroups.map(group => (
              <Box key={group.resource}>
                <ListItem
                  button
                  onClick={() => toggleGroup(group.resource)}
                  className={classes.groupHeader}
                >
                  <ListItemText
                    primary={
                      <Typography className={classes.groupTitle}>
                        {group.resource}
                      </Typography>
                    }
                    secondary={`${group.actions.length} action${group.actions.length !== 1 ? 's' : ''}`}
                  />
                  {expandedGroups.has(group.resource) ? (
                    <ExpandLess />
                  ) : (
                    <ExpandMore />
                  )}
                </ListItem>
                <Collapse
                  in={expandedGroups.has(group.resource)}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding>
                    {group.actions.map(action => (
                      <ListItem key={action} className={classes.actionItem}>
                        <ListItemText
                          primary={
                            <Typography className={classes.actionText}>
                              {action}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </Box>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};
