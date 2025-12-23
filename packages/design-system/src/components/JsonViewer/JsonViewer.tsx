import React, { useMemo } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/cjs/languages/prism/json';
import oneDark from 'react-syntax-highlighter/dist/cjs/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/cjs/styles/prism/one-light';
import { useTheme } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';

SyntaxHighlighter.registerLanguage('json', json);

export interface JsonViewerProps {
  /**
   * The value to display. Can be any JSON-serializable value.
   * Will be stringified with 2-space indentation.
   */
  value: unknown;
  /**
   * Whether to show line numbers
   * @default false
   */
  showLineNumbers?: boolean;
  /**
   * Maximum height of the container. Content will scroll if exceeded.
   * Accepts any valid CSS height value (e.g., '200px', '50vh', 'auto')
   * @default 'auto'
   */
  maxHeight?: string | number;
  /**
   * Custom indentation spaces for JSON.stringify
   * @default 2
   */
  indent?: number;
  /**
   * Whether to wrap long lines
   * @default true
   */
  wrapLongLines?: boolean;
  /**
   * Additional CSS class name for the container
   */
  className?: string;
  /**
   * Custom inline styles for the container
   */
  style?: React.CSSProperties;
}

/**
 * A component for displaying JSON data with syntax highlighting.
 * Automatically adapts to light/dark theme based on Material-UI theme.
 *
 * @example
 * // Basic usage
 * <JsonViewer value={{ key: 'value', nested: { data: true } }} />
 *
 * @example
 * // With options
 * <JsonViewer
 *   value={data}
 *   showLineNumbers
 *   maxHeight="300px"
 *   wrapLongLines={false}
 * />
 */
export const JsonViewer: React.FC<JsonViewerProps> = ({
  value,
  showLineNumbers = false,
  maxHeight = 'auto',
  indent = 2,
  wrapLongLines = true,
  className,
  style,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.type === 'dark';

  // Memoize the JSON string to avoid re-stringify on every render
  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(value, null, indent);
    } catch {
      return String(value);
    }
  }, [value, indent]);

  // Select theme based on Material-UI palette type
  const syntaxTheme = isDarkMode ? oneDark : oneLight;

  // Custom style overrides to integrate with Material-UI theme
  const customStyle: React.CSSProperties = {
    margin: 0,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.75rem',
    backgroundColor: isDarkMode
      ? 'rgba(255, 255, 255, 0.05)'
      : 'rgba(0, 0, 0, 0.03)',
    ...(maxHeight !== 'auto' && {
      maxHeight,
      overflowY: 'auto',
    }),
  };

  return (
    <Box className={className} style={style}>
      <SyntaxHighlighter
        language="json"
        style={syntaxTheme}
        showLineNumbers={showLineNumbers}
        wrapLongLines={wrapLongLines}
        customStyle={customStyle}
        codeTagProps={{
          style: {
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          },
        }}
      >
        {jsonString}
      </SyntaxHighlighter>
    </Box>
  );
};

JsonViewer.displayName = 'JsonViewer';
