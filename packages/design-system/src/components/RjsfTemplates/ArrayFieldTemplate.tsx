import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { Box, Typography, IconButton, Button } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import type { ArrayFieldTemplateProps } from '@rjsf/utils';
import { useArrayStyles } from './styles';
import { humanizeTitle } from './utils';

/** Formats a single value as a plain string (used for nested/array values). */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) {
    return value
      .map(v => (typeof v === 'object' ? formatValue(v) : String(v ?? '')))
      .filter(Boolean)
      .join(', ');
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => {
      const str = formatValue(v);
      return str ? `${humanizeTitle(k)}: ${str}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

/**
 * Builds a compact React summary from an item's form data.
 * Keys are normal weight, values and " · " separators are bold.
 */
function buildCompactSummary(data: unknown): ReactNode | null {
  if (data === null || data === undefined || data === '') return null;
  if (typeof data !== 'object') return <strong>{String(data)}</strong>;

  const record = Array.isArray(data) ? null : (data as Record<string, unknown>);
  if (!record) {
    const str = formatValue(data);
    return str ? <strong>{str}</strong> : null;
  }

  const entries = Object.entries(record)
    .map(([key, value]) => {
      const str = formatValue(value);
      return str ? { key, str } : null;
    })
    .filter(Boolean) as { key: string; str: string }[];

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry, i) => (
        <span key={entry.key}>
          {i > 0 && <strong> &middot; </strong>}
          {humanizeTitle(entry.key)}: <strong>{entry.str}</strong>
        </span>
      ))}
    </>
  );
}

/** Naive singularize for button labels (e.g. "Endpoints" → "Endpoint"). */
function singularize(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes'))
    return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Extract the top-level field key from an RJSF idSchema.
 * e.g. idSchema.$id = "root_buildArgs" → "buildArgs"
 */
function getArrayFieldKey(idSchema: any): string | null {
  const id = idSchema?.$id;
  if (!id || typeof id !== 'string' || !id.startsWith('root_')) return null;
  return id.slice(5);
}

export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const classes = useArrayStyles();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const prevItemCount = useRef(props.items.length);

  // Snapshots: confirmed item data keyed by RJSF item key (stable across re-renders)
  const snapshots = useRef<Record<string, any>>({});
  // Track which item keys are newly added (no confirmed state yet)
  const newKeys = useRef<Set<string>>(new Set());

  const ctx = props.formContext as any;

  const disableValidation = useCallback(() => {
    ctx?.disableValidation?.();
  }, [ctx]);

  // Auto-open newly added items in edit mode and mark them as new
  useEffect(() => {
    if (props.items.length > prevItemCount.current) {
      const newItem = props.items[props.items.length - 1];
      if (newItem) {
        newKeys.current.add(newItem.key);
      }
      setEditingIndex(props.items.length - 1);
    }
    prevItemCount.current = props.items.length;
  }, [props.items]);

  // Clear editing index if the edited item was removed
  useEffect(() => {
    if (editingIndex !== null && editingIndex >= props.items.length) {
      setEditingIndex(null);
    }
  }, [editingIndex, props.items.length]);

  const handleConfirm = (idx: number) => {
    const itemData = Array.isArray(props.formData)
      ? props.formData[idx]
      : undefined;
    const itemSchema = props.schema.items;
    const validateItem = ctx?.validateItem;

    // Validate the item synchronously if a validator is provided via formContext
    if (
      validateItem &&
      itemSchema &&
      typeof itemSchema === 'object' &&
      !Array.isArray(itemSchema)
    ) {
      const isValid = validateItem(itemData ?? {}, itemSchema);
      if (!isValid) {
        // Turn on liveValidate so RJSF shows inline errors on the fields
        ctx?.enableValidation?.();
        return;
      }
    }

    // Valid — item is now confirmed. Clear snapshot and new-item flag.
    const key = props.items[idx]?.key;
    if (key) {
      delete snapshots.current[key];
      newKeys.current.delete(key);
    }
    disableValidation();
    setEditingIndex(null);
  };

  const handleEdit = (idx: number) => {
    // Save a snapshot of the current (confirmed) item data before editing
    const data = Array.isArray(props.formData)
      ? props.formData[idx]
      : undefined;
    const key = props.items[idx]?.key;
    if (key && data !== undefined) {
      snapshots.current[key] = JSON.parse(JSON.stringify(data));
    }
    disableValidation();
    setEditingIndex(idx);
  };

  const handleCancel = (idx: number) => {
    const item = props.items[idx];
    if (!item) return;

    disableValidation();

    if (newKeys.current.has(item.key)) {
      // NEW item with no confirmed state: cancel = delete
      newKeys.current.delete(item.key);
      delete snapshots.current[item.key];
      item.onDropIndexClick(item.index)();
    } else if (snapshots.current[item.key]) {
      // EXISTING item: revert to the snapshot (confirmed state)
      const fieldKey = getArrayFieldKey(props.idSchema);
      if (fieldKey) {
        ctx?.revertArrayItem?.(fieldKey, idx, snapshots.current[item.key]);
      }
      delete snapshots.current[item.key];
      setEditingIndex(null);
    } else {
      // No snapshot (e.g. formContext.revertArrayItem not provided) — just close
      setEditingIndex(null);
    }
  };

  const handleAdd = () => {
    disableValidation();
    props.onAddClick();
  };

  const isEditing = editingIndex !== null;
  const itemLabel = props.title
    ? singularize(humanizeTitle(props.title))
    : 'Item';

  return (
    <Box className={classes.container}>
      {props.title && (
        <Box className={classes.header}>
          <Typography variant="h5" className={classes.title}>
            {humanizeTitle(props.title)}
          </Typography>
        </Box>
      )}
      {props.schema.description && (
        <Typography variant="body2" className={classes.description}>
          {props.schema.description}
        </Typography>
      )}

      {props.items.map((item, idx) => {
        const isItemEditing = editingIndex === idx;
        const itemData = Array.isArray(props.formData)
          ? props.formData[idx]
          : undefined;
        const summary = buildCompactSummary(itemData);

        if (isItemEditing) {
          return (
            <Box key={item.key} className={classes.editItem}>
              <Box className={classes.itemContent}>{item.children}</Box>
              <Box className={classes.editActions}>
                <IconButton
                  className={classes.confirmButton}
                  size="small"
                  onClick={() => handleConfirm(idx)}
                  aria-label="Done"
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton
                  className={classes.actionButton}
                  size="small"
                  onClick={() => handleCancel(idx)}
                  aria-label="Cancel"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                {item.hasRemove && (
                  <IconButton
                    className={classes.deleteButton}
                    size="small"
                    onClick={item.onDropIndexClick(item.index)}
                    disabled={item.disabled || item.readonly}
                    aria-label="Delete"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          );
        }

        return (
          <Box key={item.key} className={classes.compactItem}>
            <Typography variant="body2" className={classes.compactSummary}>
              {summary || (
                <Box component="span" className={classes.emptyLabel}>
                  Empty {itemLabel}
                </Box>
              )}
            </Typography>
            <Box className={classes.compactActions}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={() => handleEdit(idx)}
                disabled={isEditing || item.disabled || item.readonly}
                className={classes.editButton}
              >
                Edit
              </Button>
              {item.hasRemove && (
                <IconButton
                  className={classes.deleteButton}
                  size="small"
                  onClick={item.onDropIndexClick(item.index)}
                  disabled={isEditing || item.disabled || item.readonly}
                  aria-label="Delete"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>
        );
      })}

      {props.canAdd && (
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={isEditing || props.disabled || props.readonly}
          className={classes.addButton}
        >
          Add {itemLabel}
        </Button>
      )}
    </Box>
  );
}

ArrayFieldTemplate.displayName = 'ArrayFieldTemplate';
