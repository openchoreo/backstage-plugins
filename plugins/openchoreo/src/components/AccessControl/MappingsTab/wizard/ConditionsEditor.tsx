import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  TextField,
  Chip,
  Tooltip,
} from '@material-ui/core';
import { Autocomplete } from '@material-ui/lab';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/DeleteOutlined';
import EditIcon from '@material-ui/icons/EditOutlined';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { ActionInfo, ConditionAttribute } from '../../hooks';
import { WizardCondition } from './types';
import {
  expandWildcardRoleActions,
  getCompatibleConditionActions,
  getConditionableActions,
} from './utils';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    backgroundColor: theme.palette.background.default,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  headerLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  headerSpacer: {
    flex: 1,
  },
  hint: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  conditionCard: {
    padding: theme.spacing(1.5, 2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  conditionEditing: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.primary.light}`,
  },
  conditionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  conditionTitle: {
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  fieldLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  expressionField: {
    fontFamily: 'monospace',
  },
  attributeChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    alignItems: 'center',
  },
  emptyMessage: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
    fontSize: '0.85rem',
  },
  readOnlyExpression: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  readOnlyActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  collapsedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
  },
  collapsedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
    userSelect: 'none',
  },
  collapsedSummary: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
  },
  collapsedActions: {
    display: 'flex',
    flexWrap: 'nowrap',
    gap: theme.spacing(0.25),
    overflow: 'hidden',
    maxWidth: '40%',
  },
  errorText: {
    color: theme.palette.error.main,
    fontSize: '0.75rem',
  },
}));

export const NO_CONDITIONABLE_ACTIONS_MSG =
  'None of this role’s actions support attribute-based conditions';

interface ConditionsEditorProps {
  conditions: WizardCondition[];
  /** Actions granted by the selected role (strict suggestions list) */
  roleActions: string[];
  /** Full action catalog — used to look up `conditions` (attribute hints) per action */
  actionCatalog: ActionInfo[];
  onChange: (next: WizardCondition[]) => void;
  /** Disable add/edit (e.g. while the role/scope row is being edited) */
  disabled?: boolean;
  /**
   * When true, suppresses the internal header (label, info hint, Add button).
   * Use when the parent component already provides those affordances.
   */
  hideHeader?: boolean;
  /**
   * Fires whenever a row enters or leaves edit mode. Parents use this to
   * gate sibling actions (e.g. their own Add/Save buttons) while a row is
   * mid-edit.
   */
  onEditingChange?: (isEditing: boolean) => void;
}

const newConditionId = () =>
  `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  current: string,
  onUpdate: (next: string) => void,
) {
  const start = textarea.selectionStart ?? current.length;
  const end = textarea.selectionEnd ?? current.length;
  const next = current.slice(0, start) + text + current.slice(end);
  onUpdate(next);
  requestAnimationFrame(() => {
    textarea.focus();
    const pos = start + text.length;
    textarea.setSelectionRange(pos, pos);
  });
}

const summarizeExpression = (expr: string, max = 60): string =>
  expr.length <= max ? expr : `${expr.slice(0, max).trimEnd()}…`;

const summarizeActions = (actions: string[], max = 3): string =>
  actions.length <= max
    ? actions.join(', ')
    : `${actions.slice(0, max).join(', ')} +${actions.length - max} more`;

// Intersection of attributes across selected actions — an attribute is only
// usable in the CEL expression if every selected action supports it.
const attributesForActions = (
  selected: string[],
  actionCatalog: ActionInfo[],
): ConditionAttribute[] => {
  if (selected.length === 0) return [];
  const matched = selected
    .map(name => actionCatalog.find(a => a.name === name))
    .filter((a): a is ActionInfo => !!a);
  if (matched.length === 0) return [];
  const [first, ...rest] = matched;
  const firstAttrs = first.conditions ?? [];
  return firstAttrs.filter(attr =>
    rest.every(a => (a.conditions ?? []).some(c => c.key === attr.key)),
  );
};

type Classes = ReturnType<typeof useStyles>;

const EmptyHeader = ({
  classes,
  roleActions,
  hasConditionableActions,
  addDisabled,
  onAdd,
}: {
  classes: Classes;
  roleActions: string[];
  hasConditionableActions: boolean;
  addDisabled: boolean;
  onAdd: () => void;
}) => {
  const tooltip = (() => {
    if (roleActions.length === 0)
      return 'Select a role first to add conditions';
    if (!hasConditionableActions) return NO_CONDITIONABLE_ACTIONS_MSG;
    return '';
  })();
  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Typography className={classes.headerLabel}>Conditions</Typography>
        <Typography className={classes.hint}>
          <InfoOutlinedIcon style={{ fontSize: 14 }} />
          None — all granted actions apply unconditionally
        </Typography>
        <Box className={classes.headerSpacer} />
        <Tooltip title={tooltip}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onAdd}
              disabled={
                addDisabled ||
                roleActions.length === 0 ||
                !hasConditionableActions
              }
            >
              Add condition
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
};

const PopulatedHeader = ({
  classes,
  count,
  hasConditionableActions,
  addDisabled,
  onAdd,
}: {
  classes: Classes;
  count: number;
  hasConditionableActions: boolean;
  addDisabled: boolean;
  onAdd: () => void;
}) => (
  <Box className={classes.header}>
    <Typography className={classes.headerLabel}>
      Conditions ({count})
    </Typography>
    {count > 1 && (
      <Typography className={classes.hint}>
        <InfoOutlinedIcon style={{ fontSize: 14 }} />
        Multiple conditions are combined with OR
      </Typography>
    )}
    <Box className={classes.headerSpacer} />
    <Tooltip
      title={!hasConditionableActions ? NO_CONDITIONABLE_ACTIONS_MSG : ''}
    >
      <span>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAdd}
          disabled={addDisabled || !hasConditionableActions}
        >
          Add condition
        </Button>
      </span>
    </Tooltip>
  </Box>
);

const ConditionEditingCard = ({
  classes,
  cond,
  index,
  roleActions,
  allRoleActions,
  actionCatalog,
  onUpdate,
  onConfirm,
  onCancel,
}: {
  classes: Classes;
  cond: WizardCondition;
  index: number;
  roleActions: string[];
  allRoleActions: string[];
  actionCatalog: ActionInfo[];
  onUpdate: (patch: Partial<WizardCondition>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const expressionRef = useRef<HTMLTextAreaElement | null>(null);
  const attrs = attributesForActions(cond.actions, actionCatalog);
  const noSharedAttrs = cond.actions.length > 0 && attrs.length === 0;
  const missingActions = cond.actions.length === 0;
  const missingExpression = !cond.expression.trim();
  const hasErrors = missingActions || missingExpression || noSharedAttrs;
  const confirmTooltip = (() => {
    const reasons: string[] = [];
    if (missingActions) reasons.push('Select at least one action');
    if (noSharedAttrs)
      reasons.push('No attributes available for the selected action(s)');
    else if (missingExpression) reasons.push('Expression is required');
    return reasons.join('; ');
  })();
  const options =
    cond.actions.length === 0 || attrs.length === 0
      ? allRoleActions
      : getCompatibleConditionActions(cond.actions, roleActions, actionCatalog);

  return (
    <Paper
      variant="outlined"
      className={`${classes.conditionCard} ${classes.conditionEditing}`}
    >
      <Box className={classes.conditionHeader}>
        <Typography className={classes.conditionTitle}>
          Condition #{index + 1}
        </Typography>
        <Box className={classes.headerSpacer} />
        <Tooltip title={hasErrors ? confirmTooltip : 'Confirm'}>
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={onConfirm}
              disabled={hasErrors}
              aria-label="Confirm"
            >
              <CheckIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={onCancel} title="Cancel">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box>
        <Typography className={classes.fieldLabel} gutterBottom>
          Actions *
        </Typography>
        <Autocomplete
          multiple
          size="small"
          options={options}
          value={cond.actions}
          onChange={(_, value) => onUpdate({ actions: value as string[] })}
          renderTags={(value, getTagProps) =>
            value.map((option, i) => (
              <Chip
                size="small"
                label={option}
                {...getTagProps({ index: i })}
              />
            ))
          }
          renderInput={params => (
            <TextField
              {...params}
              variant="outlined"
              placeholder={
                cond.actions.length === 0 ? 'Select actions from the role…' : ''
              }
            />
          )}
        />
      </Box>

      <Box>
        <Typography className={classes.fieldLabel} gutterBottom>
          Expression *
        </Typography>
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          variant="outlined"
          size="small"
          value={cond.expression}
          onChange={e => onUpdate({ expression: e.target.value })}
          placeholder='e.g. resource.environment in ["dev", "staging"]'
          disabled={noSharedAttrs}
          inputRef={el => {
            expressionRef.current = el;
          }}
          InputProps={{
            classes: { input: classes.expressionField },
          }}
        />
        {noSharedAttrs && (
          <Typography className={classes.errorText}>
            No attributes available for the selected action(s)
          </Typography>
        )}
      </Box>

      {attrs.length > 0 && (
        <Box>
          <Typography className={classes.fieldLabel} gutterBottom>
            Available attributes (click to insert)
          </Typography>
          <Box className={classes.attributeChips}>
            {attrs.map(attr => (
              <Tooltip key={attr.key} title={attr.description}>
                <Chip
                  size="small"
                  label={attr.key}
                  icon={<AddIcon fontSize="small" />}
                  onClick={() => {
                    const ta = expressionRef.current;
                    if (ta) {
                      insertAtCursor(ta, attr.key, cond.expression, next =>
                        onUpdate({ expression: next }),
                      );
                    } else {
                      onUpdate({ expression: cond.expression + attr.key });
                    }
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

const ConditionCollapsedRow = ({
  classes,
  cond,
  index,
  disabled,
  onExpand,
  onEdit,
  onDelete,
}: {
  classes: Classes;
  cond: WizardCondition;
  index: number;
  disabled: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <Paper variant="outlined" className={classes.collapsedRow}>
    <Box
      className={classes.collapsedToggle}
      onClick={onExpand}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand();
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={false}
    >
      <ExpandMoreIcon fontSize="small" />
      <Typography className={classes.conditionTitle}>#{index + 1}</Typography>
      <Typography className={classes.collapsedSummary}>
        {summarizeActions(cond.actions)}
        {cond.expression ? ` — ${summarizeExpression(cond.expression)}` : ''}
      </Typography>
    </Box>
    <IconButton size="small" onClick={onEdit} disabled={disabled} title="Edit">
      <EditIcon fontSize="small" />
    </IconButton>
    <IconButton
      size="small"
      onClick={onDelete}
      disabled={disabled}
      title="Delete"
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  </Paper>
);

const ConditionExpandedCard = ({
  classes,
  cond,
  index,
  disabled,
  onCollapse,
  onEdit,
  onDelete,
}: {
  classes: Classes;
  cond: WizardCondition;
  index: number;
  disabled: boolean;
  onCollapse: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <Paper variant="outlined" className={classes.conditionCard}>
    <Box className={classes.conditionHeader}>
      <Box
        className={classes.collapsedToggle}
        onClick={onCollapse}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCollapse();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded
      >
        <ExpandLessIcon fontSize="small" />
        <Typography className={classes.conditionTitle}>
          Condition #{index + 1}
        </Typography>
      </Box>
      <Box className={classes.headerSpacer} />
      <IconButton
        size="small"
        onClick={onEdit}
        disabled={disabled}
        title="Edit"
      >
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={onDelete}
        disabled={disabled}
        title="Delete"
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>

    <Box>
      <Typography className={classes.fieldLabel} gutterBottom>
        Actions
      </Typography>
      <Box className={classes.readOnlyActions}>
        {cond.actions.map(a => (
          <Chip key={a} size="small" label={a} variant="outlined" />
        ))}
      </Box>
    </Box>

    <Box>
      <Typography className={classes.fieldLabel} gutterBottom>
        Expression
      </Typography>
      <Box className={classes.readOnlyExpression}>{cond.expression}</Box>
    </Box>
  </Paper>
);

export const ConditionsEditor = ({
  conditions,
  roleActions,
  actionCatalog,
  onChange,
  disabled = false,
  hideHeader = false,
  onEditingChange,
}: ConditionsEditorProps) => {
  const classes = useStyles();

  // Tracks the row the user opened for editing by clicking Edit on a saved row.
  // If this is null, we fall back to editing the first row that hasn't been
  // confirmed yet (i.e. a freshly added row).
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  // A backup copy of the row's values from the moment editing started, so we
  // can put them back if the user clicks Cancel.
  const [backupBeforeEdit, setBackupBeforeEdit] =
    useState<WizardCondition | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const editingId =
    editingRowId ?? conditions.find(c => !c.confirmed)?.id ?? null;

  useEffect(() => {
    onEditingChange?.(editingId !== null);
  }, [editingId, onEditingChange]);

  // If the row we were editing has been removed from outside, clear our state
  // so we don't keep pointing at a row that no longer exists.
  useEffect(() => {
    if (editingRowId && !conditions.some(c => c.id === editingRowId)) {
      setEditingRowId(null);
      setBackupBeforeEdit(null);
    }
  }, [conditions, editingRowId]);

  const allRoleActions = expandWildcardRoleActions(roleActions, actionCatalog);
  const conditionableActions = getConditionableActions(
    roleActions,
    actionCatalog,
  );
  const hasConditionableActions = conditionableActions.length > 0;

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateField = (id: string, patch: Partial<WizardCondition>) => {
    onChange(conditions.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleAdd = () => {
    onChange([
      ...conditions,
      {
        id: newConditionId(),
        actions: [],
        expression: '',
        confirmed: false,
      },
    ]);
  };

  const handleStartEdit = (id: string) => {
    const target = conditions.find(c => c.id === id);
    if (!target) return;
    setEditingRowId(id);
    setBackupBeforeEdit({ ...target });
  };

  const handleConfirm = (id: string) => {
    onChange(
      conditions.map(c => (c.id === id ? { ...c, confirmed: true } : c)),
    );
    setEditingRowId(null);
    setBackupBeforeEdit(null);
  };

  const handleCancel = (id: string) => {
    const current = conditions.find(c => c.id === id);
    if (!current) {
      setEditingRowId(null);
      setBackupBeforeEdit(null);
      return;
    }
    if (backupBeforeEdit) {
      onChange(conditions.map(c => (c.id === id ? backupBeforeEdit : c)));
    } else {
      onChange(conditions.filter(c => c.id !== id));
    }
    setEditingRowId(null);
    setBackupBeforeEdit(null);
  };

  const handleDelete = (id: string) => {
    if (editingRowId === id) {
      setEditingRowId(null);
      setBackupBeforeEdit(null);
    }
    onChange(conditions.filter(c => c.id !== id));
  };

  if (conditions.length === 0) {
    if (hideHeader) return null;
    return (
      <EmptyHeader
        classes={classes}
        roleActions={roleActions}
        hasConditionableActions={hasConditionableActions}
        addDisabled={disabled || editingId !== null}
        onAdd={handleAdd}
      />
    );
  }

  return (
    <Box className={classes.root}>
      {!hideHeader && (
        <PopulatedHeader
          classes={classes}
          count={conditions.length}
          hasConditionableActions={hasConditionableActions}
          addDisabled={disabled || editingId !== null}
          onAdd={handleAdd}
        />
      )}

      {conditions.map((cond, index) => {
        if (cond.id === editingId) {
          return (
            <ConditionEditingCard
              key={cond.id}
              classes={classes}
              cond={cond}
              index={index}
              roleActions={roleActions}
              allRoleActions={allRoleActions}
              actionCatalog={actionCatalog}
              onUpdate={patch => updateField(cond.id, patch)}
              onConfirm={() => handleConfirm(cond.id)}
              onCancel={() => handleCancel(cond.id)}
            />
          );
        }

        const isExpanded = expandedIds.has(cond.id);
        const rowDisabled = disabled || editingId !== null;

        return isExpanded ? (
          <ConditionExpandedCard
            key={cond.id}
            classes={classes}
            cond={cond}
            index={index}
            disabled={rowDisabled}
            onCollapse={() => toggleExpanded(cond.id)}
            onEdit={() => handleStartEdit(cond.id)}
            onDelete={() => handleDelete(cond.id)}
          />
        ) : (
          <ConditionCollapsedRow
            key={cond.id}
            classes={classes}
            cond={cond}
            index={index}
            disabled={rowDisabled}
            onExpand={() => toggleExpanded(cond.id)}
            onEdit={() => handleStartEdit(cond.id)}
            onDelete={() => handleDelete(cond.id)}
          />
        );
      })}
    </Box>
  );
};
