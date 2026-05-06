import { useEffect, useRef } from 'react';
import { Box, Typography } from '@material-ui/core';
import { makeStyles, type Theme } from '@material-ui/core/styles';
import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { StreamLanguage } from '@codemirror/language';
import { yaml as yamlSupport } from '@codemirror/legacy-modes/mode/yaml';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';

export interface YamlDiffViewerProps {
  /** Original (left) YAML — typically the upstream env's manifest. */
  original: string;
  /** Modified (right) YAML — typically the current env's manifest. */
  modified: string;
  /** Side-by-side ('a-b') or reversed ('b-a'). Default 'a-b'. */
  orientation?: 'a-b' | 'b-a';
  /** Optional column headers shown above each side. */
  originalLabel?: string;
  modifiedLabel?: string;
  /** Container height. Default '60vh'. */
  height?: string | number;
  className?: string;
}

type StyleProps = { height: string | number; isDark: boolean };

const useStyles = makeStyles<Theme, StyleProps>(theme => ({
  headerRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    backgroundColor: theme.palette.background.default,
    borderTopLeftRadius: theme.shape.borderRadius,
    borderTopRightRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    borderBottom: 'none',
  },
  headerLabel: {
    fontWeight: 600,
    fontSize: '0.7rem',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  container: ({ height, isDark }) => ({
    height,
    fontSize: '0.75rem',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
    '& .cm-mergeView, & .cm-mergeViewEditors': {
      height: '100%',
    },
    '& .cm-editor': {
      height: '100%',
      backgroundColor: 'transparent',
    },
    '& .cm-scroller': {
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
    '& .cm-content, & .cm-gutters': {
      color: isDark ? '#d4d4d4' : '#24292e',
    },
    '& .cm-gutters': {
      backgroundColor: isDark ? '#252526' : '#f0f0f0',
      borderRight: `1px solid ${theme.palette.divider}`,
    },
    // Vertical separator between the two editors.
    '& .cm-merge-a': {
      borderRight: `1px solid ${theme.palette.divider}`,
    },
    // Inserted / deleted line tints — use translucent semantic colors so
    // they read well in light + dark.
    '& .cm-insertedLine, & .cm-changedLine': {
      backgroundColor: isDark
        ? 'rgba(46, 160, 67, 0.18)'
        : 'rgba(46, 160, 67, 0.12)',
    },
    '& .cm-deletedChunk, & .cm-deletedLine': {
      backgroundColor: isDark
        ? 'rgba(248, 81, 73, 0.18)'
        : 'rgba(248, 81, 73, 0.12)',
    },
    '& .cm-changedText': {
      backgroundColor: isDark
        ? 'rgba(255, 200, 0, 0.25)'
        : 'rgba(255, 200, 0, 0.4)',
    },
  }),
}));

/**
 * Side-by-side YAML diff viewer built on @codemirror/merge. Read-only;
 * use this for surfacing version drift, environment overrides, or any
 * other "compare two YAML manifests" workflow. Both editors share the
 * YAML language for syntax highlighting and align unchanged lines.
 */
export const YamlDiffViewer = ({
  original,
  modified,
  orientation = 'a-b',
  originalLabel,
  modifiedLabel,
  height = '60vh',
  className,
}: YamlDiffViewerProps) => {
  const tokens = useChoreoTokens();
  const isDark = tokens.editor.codeMirrorTheme === 'dark';
  const classes = useStyles({ height, isDark });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    // MergeView is imperative — destroy + rebuild whenever the docs
    // change. The dialog hosts are short-lived, so rebuild cost is fine.
    const view = new MergeView({
      a: {
        doc: original,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          StreamLanguage.define(yamlSupport),
          EditorView.lineWrapping,
        ],
      },
      b: {
        doc: modified,
        extensions: [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          StreamLanguage.define(yamlSupport),
          EditorView.lineWrapping,
        ],
      },
      parent: containerRef.current,
      orientation,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 6 },
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [original, modified, orientation]);

  return (
    <Box className={className}>
      {(originalLabel || modifiedLabel) && (
        <Box className={classes.headerRow}>
          <Typography className={classes.headerLabel} title={originalLabel}>
            {originalLabel}
          </Typography>
          <Typography className={classes.headerLabel} title={modifiedLabel}>
            {modifiedLabel}
          </Typography>
        </Box>
      )}
      <div ref={containerRef} className={classes.container} />
    </Box>
  );
};

YamlDiffViewer.displayName = 'YamlDiffViewer';
