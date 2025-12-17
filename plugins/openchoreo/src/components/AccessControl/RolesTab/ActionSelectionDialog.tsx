import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Collapse,
  IconButton,
  Divider,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import {
  groupActionsByCategory,
  expandWildcards,
  convertToWildcards,
} from './actionUtils';

const useStyles = makeStyles(theme => ({
  searchField: {
    marginBottom: theme.spacing(2),
  },
  allActionsRow: {
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 0),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  categoryTitle: {
    fontWeight: 600,
    textTransform: 'uppercase',
    flex: 1,
  },
  categoryContent: {
    paddingLeft: theme.spacing(4),
  },
  selectAllRow: {
    borderBottom: `1px dashed ${theme.palette.divider}`,
    marginBottom: theme.spacing(1),
  },
  actionsList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  dialogContent: {
    minHeight: 400,
    maxHeight: 500,
  },
  noResults: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  selectionCount: {
    color: theme.palette.text.secondary,
  },
}));

interface ActionSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (actions: string[]) => void;
  availableActions: string[];
  selectedActions: string[];
}

export const ActionSelectionDialog = ({
  open,
  onClose,
  onConfirm,
  availableActions,
  selectedActions,
}: ActionSelectionDialogProps) => {
  const classes = useStyles();

  // Internal state for selections (expanded individual actions)
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  // Group available actions by category
  const groupedActions = useMemo(
    () => groupActionsByCategory(availableActions),
    [availableActions],
  );

  const categories = useMemo(
    () => Object.keys(groupedActions).sort(),
    [groupedActions],
  );

  // Initialize selection when dialog opens
  useEffect(() => {
    if (open) {
      const expanded = expandWildcards(selectedActions, availableActions);
      setSelection(expanded);
      setSearchQuery('');
      // Expand all categories by default
      setExpandedCategories(new Set(categories));
    }
  }, [open, selectedActions, availableActions, categories]);

  // Filter actions based on search query
  const filteredGroupedActions = useMemo(() => {
    if (!searchQuery) return groupedActions;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, string[]> = {};

    for (const [category, actions] of Object.entries(groupedActions)) {
      const matchingActions = actions.filter(action =>
        action.toLowerCase().includes(query),
      );
      if (matchingActions.length > 0) {
        filtered[category] = matchingActions;
      }
    }

    return filtered;
  }, [groupedActions, searchQuery]);

  const filteredCategories = useMemo(
    () => Object.keys(filteredGroupedActions).sort(),
    [filteredGroupedActions],
  );

  // Check if all actions are selected
  const allSelected =
    availableActions.length > 0 &&
    availableActions.every(a => selection.has(a));

  // Check if some (but not all) actions are selected
  const someSelected = selection.size > 0 && !allSelected;

  // Toggle all actions
  const handleToggleAll = () => {
    if (allSelected) {
      setSelection(new Set());
    } else {
      setSelection(new Set(availableActions));
    }
  };

  // Check category selection state
  const getCategoryState = (category: string) => {
    const categoryActions = groupedActions[category] || [];
    const selectedCount = categoryActions.filter(a => selection.has(a)).length;

    if (selectedCount === 0) return 'none';
    if (selectedCount === categoryActions.length) return 'all';
    return 'some';
  };

  // Toggle all actions in a category
  const handleToggleCategory = (category: string) => {
    const categoryActions = groupedActions[category] || [];
    const state = getCategoryState(category);

    const newSelection = new Set(selection);
    if (state === 'all') {
      // Deselect all in category
      categoryActions.forEach(a => newSelection.delete(a));
    } else {
      // Select all in category
      categoryActions.forEach(a => newSelection.add(a));
    }
    setSelection(newSelection);
  };

  // Toggle individual action
  const handleToggleAction = (action: string) => {
    const newSelection = new Set(selection);
    if (newSelection.has(action)) {
      newSelection.delete(action);
    } else {
      newSelection.add(action);
    }
    setSelection(newSelection);
  };

  // Toggle category expand/collapse
  const handleToggleExpand = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Handle confirm - convert to wildcards
  const handleConfirm = () => {
    const result = convertToWildcards(selection, availableActions);
    onConfirm(result);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span>Select Actions</span>
          <Typography variant="body2" className={classes.selectionCount}>
            {selection.size} of {availableActions.length} selected
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <TextField
          className={classes.searchField}
          placeholder="Search actions..."
          variant="outlined"
          size="small"
          fullWidth
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

        {/* All Actions checkbox */}
        {!searchQuery && (
          <Box className={classes.allActionsRow}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={handleToggleAll}
                  color="primary"
                />
              }
              label={
                <Typography variant="body1">
                  <strong>All Actions</strong> (*)
                </Typography>
              }
            />
          </Box>
        )}

        {filteredCategories.length === 0 ? (
          <Box className={classes.noResults}>
            <Typography>No actions match your search</Typography>
          </Box>
        ) : (
          filteredCategories.map(category => {
            const categoryActions = filteredGroupedActions[category];
            const state = getCategoryState(category);
            const isExpanded = expandedCategories.has(category);

            return (
              <Box key={category}>
                <Box
                  className={classes.categoryHeader}
                  onClick={() => handleToggleExpand(category)}
                >
                  <IconButton size="small">
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                  <Typography
                    variant="subtitle2"
                    className={classes.categoryTitle}
                  >
                    {category}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {
                      (groupedActions[category] || []).filter(a =>
                        selection.has(a),
                      ).length
                    }
                    /{(groupedActions[category] || []).length}
                  </Typography>
                </Box>

                <Collapse in={isExpanded}>
                  <Box className={classes.categoryContent}>
                    {/* Select all in category */}
                    {!searchQuery && (
                      <Box className={classes.selectAllRow}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={state === 'all'}
                              indeterminate={state === 'some'}
                              onChange={() => handleToggleCategory(category)}
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">
                              Select all {category} actions ({category}:*)
                            </Typography>
                          }
                        />
                      </Box>
                    )}

                    {/* Individual actions */}
                    <Box className={classes.actionsList}>
                      {categoryActions.map(action => (
                        <FormControlLabel
                          key={action}
                          control={
                            <Checkbox
                              checked={selection.has(action)}
                              onChange={() => handleToggleAction(action)}
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2">{action}</Typography>
                          }
                        />
                      ))}
                    </Box>
                  </Box>
                </Collapse>
                <Divider />
              </Box>
            );
          })
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={selection.size === 0}
        >
          Confirm Selection
        </Button>
      </DialogActions>
    </Dialog>
  );
};
