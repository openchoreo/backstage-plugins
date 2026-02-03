import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Box,
  Chip,
  Tooltip,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';

interface AnnotationSuggestion {
  key: string;
  description: string;
  placeholder: string;
}

const ANNOTATION_SUGGESTIONS: AnnotationSuggestion[] = [
  {
    key: 'jenkins.io/job-full-name',
    description: 'Jenkins job name (e.g., folder/job-name)',
    placeholder: 'my-folder/my-job',
  },
  {
    key: 'github.com/project-slug',
    description: 'GitHub repository slug',
    placeholder: 'org/repo-name',
  },
  {
    key: 'sonarqube.org/project-key',
    description: 'SonarQube project key',
    placeholder: 'my-project-key',
  },
  {
    key: 'pagerduty.com/service-id',
    description: 'PagerDuty service ID',
    placeholder: 'PXXXXXX',
  },
  {
    key: 'pagerduty.com/integration-key',
    description: 'PagerDuty integration key',
    placeholder: 'abc123def456',
  },
  {
    key: 'backstage.io/techdocs-ref',
    description: 'TechDocs content location',
    placeholder: 'dir:.',
  },
  {
    key: 'grafana/dashboard-selector',
    description: 'Grafana dashboard selector',
    placeholder: 'title:My Dashboard',
  },
  {
    key: 'grafana/alert-label-selector',
    description: 'Grafana alert label selector',
    placeholder: 'service=my-service',
  },
  {
    key: 'jira/project-key',
    description: 'Jira project key',
    placeholder: 'PROJ',
  },
  {
    key: 'sentry.io/project-slug',
    description: 'Sentry project slug',
    placeholder: 'my-sentry-project',
  },
];

const BLOCKED_PREFIXES = [
  'openchoreo.io/',
  'openchoreo.dev/',
  'backstage.io/managed-by-',
  'kubernetes.io/',
  'kubectl.kubernetes.io/',
];

function isBlockedKey(key: string): boolean {
  return BLOCKED_PREFIXES.some(prefix => key.startsWith(prefix));
}

interface AnnotationRow {
  key: string;
  value: string;
  isNew?: boolean;
}

const useStyles = makeStyles(theme => ({
  dialogContent: {
    paddingTop: theme.spacing(1),
    minWidth: 500,
  },
  keyCell: {
    width: '40%',
  },
  valueCell: {
    width: '50%',
  },
  actionCell: {
    width: '10%',
  },
  addButton: {
    marginTop: theme.spacing(1),
  },
  suggestionsSection: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  suggestionsLabel: {
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
  },
  suggestionsContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: theme.spacing(0.5),
  },
  emptyState: {
    padding: theme.spacing(3),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  errorText: {
    color: theme.palette.error.main,
    fontSize: '0.75rem',
    marginTop: theme.spacing(0.5),
  },
}));

interface EditAnnotationsDialogProps {
  open: boolean;
  onClose: () => void;
  entity: Entity;
}

export function EditAnnotationsDialog({
  open,
  onClose,
  entity,
}: EditAnnotationsDialogProps) {
  const classes = useStyles();
  const openChoreoClient = useApi(openChoreoClientApiRef);
  const alertApi = useApi(alertApiRef);

  const [rows, setRows] = useState<AnnotationRow[]>([]);
  const [originalAnnotations, setOriginalAnnotations] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing annotations when dialog opens
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    openChoreoClient
      .fetchEntityAnnotations(entity)
      .then(annotations => {
        setOriginalAnnotations(annotations);
        setRows(
          Object.entries(annotations).map(([key, value]) => ({
            key,
            value,
          })),
        );
      })
      .catch(err => {
        setError(err.message || 'Failed to load annotations');
        setRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, entity, openChoreoClient]);

  const handleAddRow = useCallback(() => {
    setRows(prev => [...prev, { key: '', value: '', isNew: true }]);
  }, []);

  const handleRemoveRow = useCallback((index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyChange = useCallback((index: number, newKey: string) => {
    setRows(prev =>
      prev.map((row, i) => (i === index ? { ...row, key: newKey } : row)),
    );
  }, []);

  const handleValueChange = useCallback((index: number, newValue: string) => {
    setRows(prev =>
      prev.map((row, i) => (i === index ? { ...row, value: newValue } : row)),
    );
  }, []);

  const getKeyError = useCallback(
    (key: string, index: number): string | null => {
      if (!key.trim()) return null; // Don't show error for empty fields yet
      if (isBlockedKey(key)) return 'This annotation prefix is system-managed';
      // Check for duplicate keys
      const duplicateIndex = rows.findIndex(
        (r, i) => i !== index && r.key === key,
      );
      if (duplicateIndex !== -1) return 'Duplicate annotation key';
      return null;
    },
    [rows],
  );

  const handleSave = useCallback(async () => {
    // Validate all rows
    const validRows = rows.filter(r => r.key.trim() && r.value.trim());
    const invalidRows = rows.filter(
      r =>
        (r.key.trim() && !r.value.trim()) || (!r.key.trim() && r.value.trim()),
    );

    if (invalidRows.length > 0) {
      setError('Each annotation must have both a key and a value');
      return;
    }

    // Check for blocked keys
    const blockedKeys = validRows.filter(r => isBlockedKey(r.key));
    if (blockedKeys.length > 0) {
      setError(
        `Cannot set system-managed annotations: ${blockedKeys
          .map(r => r.key)
          .join(', ')}`,
      );
      return;
    }

    // Check for duplicate keys
    const keys = validRows.map(r => r.key);
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      setError('Duplicate annotation keys are not allowed');
      return;
    }

    // Compute diff: what to set and what to delete
    const annotations: Record<string, string | null> = {};

    // Add/update annotations from current rows
    for (const row of validRows) {
      annotations[row.key] = row.value;
    }

    // Delete annotations that were in original but not in current rows
    for (const originalKey of Object.keys(originalAnnotations)) {
      if (!validRows.some(r => r.key === originalKey)) {
        annotations[originalKey] = null;
      }
    }

    // If no changes, just close
    if (Object.keys(annotations).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await openChoreoClient.updateEntityAnnotations(entity, annotations);

      alertApi.post({
        message: `Annotations updated for ${stringifyEntityRef(entity)}`,
        severity: 'success',
        display: 'transient',
      });

      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update annotations';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [rows, originalAnnotations, entity, openChoreoClient, alertApi, onClose]);

  const availableSuggestions = useMemo(() => {
    const usedKeys = new Set(rows.map(r => r.key));
    return ANNOTATION_SUGGESTIONS.filter(s => !usedKeys.has(s.key));
  }, [rows]);

  const handleAddSuggestion = useCallback(
    (suggestion: AnnotationSuggestion) => {
      setRows(prev => [
        ...prev,
        { key: suggestion.key, value: '', isNew: true },
      ]);
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="edit-annotations-dialog-title"
    >
      <DialogTitle id="edit-annotations-dialog-title" disableTypography>
        <Typography variant="h4">Edit Custom Annotations</Typography>
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {rows.length === 0 ? (
              <Typography className={classes.emptyState}>
                No custom annotations. Click "Add Annotation" to get started.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell className={classes.keyCell}>Key</TableCell>
                    <TableCell className={classes.valueCell}>Value</TableCell>
                    <TableCell className={classes.actionCell} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, index) => {
                    const keyError = getKeyError(row.key, index);
                    return (
                      <TableRow key={index}>
                        <TableCell className={classes.keyCell}>
                          <TextField
                            fullWidth
                            size="small"
                            variant="outlined"
                            placeholder="e.g., jenkins.io/job-name"
                            value={row.key}
                            onChange={e =>
                              handleKeyChange(index, e.target.value)
                            }
                            error={!!keyError}
                            helperText={keyError}
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell className={classes.valueCell}>
                          <TextField
                            fullWidth
                            size="small"
                            variant="outlined"
                            placeholder={
                              ANNOTATION_SUGGESTIONS.find(
                                s => s.key === row.key,
                              )?.placeholder || 'Value'
                            }
                            value={row.value}
                            onChange={e =>
                              handleValueChange(index, e.target.value)
                            }
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell className={classes.actionCell}>
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveRow(index)}
                            disabled={saving}
                            aria-label="Remove annotation"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <Button
              className={classes.addButton}
              startIcon={<AddIcon />}
              onClick={handleAddRow}
              disabled={saving}
              size="small"
            >
              Add Annotation
            </Button>

            {availableSuggestions.length > 0 && (
              <Box className={classes.suggestionsSection}>
                <Typography className={classes.suggestionsLabel}>
                  Suggestions
                </Typography>
                <Box className={classes.suggestionsContainer}>
                  {availableSuggestions.map(suggestion => (
                    <Tooltip
                      key={suggestion.key}
                      title={suggestion.description}
                    >
                      <Chip
                        label={suggestion.key}
                        size="small"
                        variant="outlined"
                        onClick={() => handleAddSuggestion(suggestion)}
                        disabled={saving}
                        clickable
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            )}

            {error && (
              <Typography className={classes.errorText}>{error}</Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving} variant="contained">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="outlined"
          disabled={saving || loading}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
