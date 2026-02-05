import { useMemo, useState } from 'react';
import { StreamLanguage } from '@codemirror/language';
import { yaml as yamlSupport } from '@codemirror/legacy-modes/mode/yaml';
import { showPanel } from '@codemirror/view';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Tooltip from '@material-ui/core/Tooltip';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import SaveIcon from '@material-ui/icons/Save';
import RefreshIcon from '@material-ui/icons/Refresh';
import DeleteIcon from '@material-ui/icons/Delete';
import Brightness4Icon from '@material-ui/icons/Brightness4';
import Brightness7Icon from '@material-ui/icons/Brightness7';
import { useKeyboardEvent } from '@react-hookz/web';
import CodeMirror from '@uiw/react-codemirror';

const useStyles = makeStyles(theme => ({
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 400,
  },
  codeMirror: {
    height: '100%',
    '& .cm-editor': {
      height: '100%',
    },
    '& .cm-scroller': {
      overflow: 'auto',
    },
  },
  errorPanel: {
    color: theme.palette.error.main,
    lineHeight: 2,
    margin: theme.spacing(0, 1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.type === 'dark' ? '#2d2d2d' : '#f5f5f5',
    borderTop: `1px solid ${theme.palette.error.main}`,
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  floatingButtons: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(3),
    zIndex: 10,
  },
  floatingButton: {
    padding: theme.spacing(1),
  },
  saveButton: {
    color: theme.palette.primary.main,
  },
  discardButton: {
    color: theme.palette.warning.main,
  },
  deleteButton: {
    color: theme.palette.error.main,
  },
  themeToggleButton: {
    color: theme.palette.text.secondary,
  },
  disabledButton: {
    opacity: 0.5,
  },
  savingIndicator: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1),
  },
}));

export interface YamlEditorProps {
  /** The YAML content to display */
  content: string;
  /** Called when content changes */
  onChange: (content: string) => void;
  /** Called when save is triggered (Ctrl/Cmd+S or button click) */
  onSave?: () => void;
  /** Called when discard is triggered */
  onDiscard?: () => void;
  /** Called when delete is triggered */
  onDelete?: () => void;
  /** Error text to display in the error panel */
  errorText?: string;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

/**
 * A YAML editor component built on CodeMirror 6.
 *
 * Features:
 * - YAML syntax highlighting
 * - Ctrl/Cmd+S keyboard shortcut for saving
 * - Floating toolbar with Save, Discard, and Delete buttons
 * - Error panel for displaying validation errors
 * - Dark theme support
 */
export function YamlEditor({
  content,
  onChange,
  onSave,
  onDiscard,
  onDelete,
  errorText,
  isDirty = false,
  isSaving = false,
  readOnly = false,
}: YamlEditorProps) {
  const classes = useStyles();
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Error panel extension
  const panelExtension = useMemo(() => {
    if (!errorText) {
      return showPanel.of(null);
    }

    const dom = document.createElement('div');
    dom.classList.add(classes.errorPanel);
    dom.textContent = errorText;
    return showPanel.of(() => ({ dom, bottom: true }));
  }, [classes.errorPanel, errorText]);

  // Keyboard shortcut for save (Ctrl/Cmd+S)
  useKeyboardEvent(
    e => e.key === 's' && (e.ctrlKey || e.metaKey),
    e => {
      e.preventDefault();
      if (onSave && isDirty && !isSaving && !readOnly) {
        onSave();
      }
    },
  );

  return (
    <div className={classes.container}>
      <CodeMirror
        className={classes.codeMirror}
        theme={isDarkTheme ? 'dark' : 'light'}
        height="100%"
        extensions={[StreamLanguage.define(yamlSupport), panelExtension]}
        value={content}
        onChange={onChange}
        readOnly={readOnly}
        editable={!readOnly}
      />
      <div className={classes.floatingButtons}>
        <Paper>
          {isSaving ? (
            <div className={classes.savingIndicator}>
              <CircularProgress size={20} />
            </div>
          ) : (
            <>
              <Tooltip
                title={
                  isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'
                }
              >
                <IconButton
                  className={`${classes.floatingButton} ${classes.themeToggleButton}`}
                  onClick={() => setIsDarkTheme(!isDarkTheme)}
                  size="small"
                >
                  {isDarkTheme ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
              </Tooltip>
              {onSave && (
                <Tooltip
                  title={
                    isDirty ? 'Save changes (Ctrl+S)' : 'No changes to save'
                  }
                >
                  <span>
                    <IconButton
                      className={`${classes.floatingButton} ${
                        classes.saveButton
                      } ${!isDirty ? classes.disabledButton : ''}`}
                      onClick={onSave}
                      disabled={!isDirty || readOnly}
                      size="small"
                    >
                      <SaveIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onDiscard && (
                <Tooltip
                  title={isDirty ? 'Discard changes' : 'No changes to discard'}
                >
                  <span>
                    <IconButton
                      className={`${classes.floatingButton} ${
                        classes.discardButton
                      } ${!isDirty ? classes.disabledButton : ''}`}
                      onClick={onDiscard}
                      disabled={!isDirty || readOnly}
                      size="small"
                    >
                      <RefreshIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip title="Delete resource">
                  <IconButton
                    className={`${classes.floatingButton} ${classes.deleteButton}`}
                    onClick={onDelete}
                    disabled={readOnly}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Paper>
      </div>
    </div>
  );
}
