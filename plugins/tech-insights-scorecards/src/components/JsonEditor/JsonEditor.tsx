import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { startCompletion } from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { Prec, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormLabel from '@material-ui/core/FormLabel';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import { createSvgIcon } from '@material-ui/core/utils';
import ZoomOutMapIcon from '@material-ui/icons/ZoomOutMap';
import useLatest from 'react-use/lib/useLatest';
import { CODE_FONT_FAMILY } from '../codeStyles';
import { formatJson, isFormatKey } from './formatJson';

// Material UI v4 has ZoomOutMap but not its inverse; this is v5's ZoomInMap
// path (@mui/icons-material, MIT).
const ZoomInMapIcon = createSvgIcon(
  <path d="M9 9V3H7v2.59L3.91 2.5 2.5 3.91 5.59 7H3v2zm12 0V7h-2.59l3.09-3.09-1.41-1.41L17 5.59V3h-2v6zM3 15v2h2.59L2.5 20.09l1.41 1.41L7 18.41V21h2v-6zm12 0v6h2v-2.59l3.09 3.09 1.41-1.41L18.41 17H21v-2z" />,
  'ZoomInMap',
);

/** Room at the end of each line so text can scroll clear of the expand button. */
const EXPAND_BUTTON_WIDTH = 36;

const useStyles = makeStyles(theme => ({
  label: {
    display: 'block',
    marginBottom: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
  },
  toolbar: {
    position: 'absolute',
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    zIndex: 1,
    display: 'flex',
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: theme.spacing(2),
  },
  expandedFrame: {
    flex: 1,
    minHeight: 0,
  },
  fill: {
    height: '100%',
  },
  frame: {
    position: 'relative',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    '&:focus-within': { borderColor: theme.palette.primary.main },
  },
  frameError: {
    borderColor: theme.palette.error.main,
    '&:focus-within': { borderColor: theme.palette.error.main },
  },
}));

export interface JsonEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Language features beyond JSON syntax, such as linters and completion
   * sources. Memoize them: the editor is reconfigured, and its lint and
   * completion state reset, whenever this array changes.
   */
  extensions?: Extension[];
  error?: boolean;
  helperText?: ReactNode;
  minHeight?: string;
  placeholder?: string;
  /** Offers a full-screen view, for text longer than a few lines. */
  expandable?: boolean;
  onCreateEditor?: (view: EditorView) => void;
}

const NO_EXTENSIONS: Extension[] = [];

/**
 * Keeps an Escape the editor used, e.g. to close its suggestions, from also
 * closing a dialog around it: Material UI's Modal closes on any Escape,
 * whether or not something handled it first. It listens natively so the
 * event stops before React's listener, which drives the Modal, sees it.
 */
function guardEscape(node: HTMLDivElement | null) {
  node?.addEventListener('keydown', stopHandledEscape);
}

function stopHandledEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && event.defaultPrevented) {
    event.stopPropagation();
  }
}

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * The key that opens suggestions. macOS takes Ctrl+Space to switch input
 * sources before the page sees it, and CodeMirror's Mac fallbacks, Option+I
 * and Option+`, arrive as dead keys that its keymap can't match. Macs use
 * Cmd+I, as VS Code does.
 */
export const SUGGEST_SHORTCUT = IS_MAC ? 'Cmd+I' : 'Ctrl+Space';

export const FORMAT_SHORTCUT = IS_MAC ? 'Shift+Option+F' : 'Shift+Alt+F';

const editorKeymap = Prec.high(
  keymap.of([
    { mac: 'Mod-i', run: startCompletion },
    {
      any: (view, event) => {
        if (!isFormatKey(event)) return false;
        formatJson(view);
        return true;
      },
    },
  ]),
);

/**
 * A JSON field for forms: CodeMirror with a label and helper text like a
 * `TextField`, colored from the Material UI theme. Tab leaves the field
 * rather than indenting, so keyboard users aren't trapped in it.
 */
export function JsonEditor(props: JsonEditorProps) {
  const {
    label,
    value,
    onChange,
    extensions = NO_EXTENSIONS,
    error = false,
    helperText,
    minHeight = '12rem',
    placeholder,
    expandable = true,
    onCreateEditor,
  } = props;
  const classes = useStyles();
  const theme = useTheme();
  const dark = theme.palette.type === 'dark';
  const id = useId();
  const labelId = `${id}-label`;
  const helperId = helperText ? `${id}-helper` : undefined;
  const viewRef = useRef<EditorView>();
  const [expanded, setExpanded] = useState(false);

  // The editor reconfigures when onChange changes, which the form's inline
  // handlers would do on every render.
  const onChangeRef = useLatest(onChange);
  const handleChange = useCallback(
    (next: string) => onChangeRef.current(next),
    [onChangeRef],
  );

  const allExtensions = useMemo(
    () => [
      json(),
      editorKeymap,
      Prec.highest(
        EditorView.theme(
          {
            '&': {
              fontSize: theme.typography.body2.fontSize ?? 'inherit',
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-content, .cm-gutters, .cm-tooltip': {
              fontFamily: CODE_FONT_FAMILY,
            },
            ...(expandable && {
              '.cm-content': { paddingRight: `${EXPAND_BUTTON_WIDTH}px` },
            }),
            '.cm-gutters': {
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.secondary,
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          },
          { dark },
        ),
      ),
      EditorView.contentAttributes.of({
        'aria-labelledby': labelId,
        ...(helperId && { 'aria-describedby': helperId }),
        'aria-invalid': String(error),
      }),
      ...extensions,
    ],
    [theme, dark, labelId, helperId, error, expandable, extensions],
  );

  const helper = helperText && (
    <FormHelperText id={helperId} error={error}>
      {helperText}
    </FormHelperText>
  );

  // Only one editor is mounted at a time, inline or in the dialog, so the
  // linters run once and the view ref names the one being typed in.
  const editor = (inDialog: boolean) => (
    <div
      className={[
        classes.frame,
        error ? classes.frameError : '',
        inDialog ? classes.expandedFrame : '',
      ].join(' ')}
      ref={guardEscape}
    >
      {expandable && (
        <div className={classes.toolbar}>
          <Tooltip title={inDialog ? 'Collapse' : 'Expand'}>
            <IconButton
              size="small"
              aria-label={`${inDialog ? 'Collapse' : 'Expand'} ${label}`}
              onClick={() => setExpanded(!inDialog)}
            >
              {inDialog ? (
                <ZoomInMapIcon fontSize="small" />
              ) : (
                <ZoomOutMapIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </div>
      )}
      <CodeMirror
        className={inDialog ? classes.fill : undefined}
        value={value}
        onChange={handleChange}
        extensions={allExtensions}
        theme={dark ? 'dark' : 'light'}
        indentWithTab={false}
        height={inDialog ? '100%' : undefined}
        minHeight={inDialog ? undefined : minHeight}
        placeholder={placeholder}
        basicSetup={{
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        onCreateEditor={view => {
          viewRef.current = view;
          onCreateEditor?.(view);
        }}
      />
    </div>
  );

  return (
    <div>
      <FormLabel
        id={labelId}
        error={error}
        className={classes.label}
        onClick={() => viewRef.current?.focus()}
      >
        {label}
      </FormLabel>
      {expanded ? (
        <Typography variant="body2" color="textSecondary">
          Editing in the expanded editor.
        </Typography>
      ) : (
        editor(false)
      )}
      {!expanded && helper}
      <Dialog
        fullScreen
        open={expanded}
        onClose={() => setExpanded(false)}
        TransitionProps={{ onEntered: () => viewRef.current?.focus() }}
        aria-labelledby={`${id}-dialog-title`}
      >
        <DialogTitle id={`${id}-dialog-title`} disableTypography>
          <Typography variant="h6" component="h2">
            {label}
          </Typography>
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          {editor(true)}
          {helper}
        </DialogContent>
      </Dialog>
    </div>
  );
}
