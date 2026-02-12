import React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import yaml from 'react-syntax-highlighter/dist/cjs/languages/prism/yaml';
import oneDark from 'react-syntax-highlighter/dist/cjs/styles/prism/one-dark';
import oneLight from 'react-syntax-highlighter/dist/cjs/styles/prism/one-light';
import { useTheme } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';

SyntaxHighlighter.registerLanguage('yaml', yaml);

export interface YamlViewerProps {
  /**
   * The raw YAML string to display.
   */
  value: string;
  /**
   * Whether to show line numbers
   * @default false
   */
  showLineNumbers?: boolean;
  /**
   * Maximum height of the container. Content will scroll if exceeded.
   * Accepts any valid CSS height value (e.g., '200px', '50vh', 'auto')
   * @default '400px'
   */
  maxHeight?: string | number;
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
 * A component for displaying YAML content with syntax highlighting.
 * Automatically adapts to light/dark theme based on Material-UI theme.
 *
 * @example
 * // Basic usage
 * <YamlViewer value="key: value\nnested:\n  data: true" />
 *
 * @example
 * // With options
 * <YamlViewer
 *   value={yamlString}
 *   showLineNumbers
 *   maxHeight="300px"
 *   wrapLongLines={false}
 * />
 */
export const YamlViewer: React.FC<YamlViewerProps> = ({
  value,
  showLineNumbers = false,
  maxHeight = '400px',
  wrapLongLines = true,
  className,
  style,
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.type === 'dark';

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
        language="yaml"
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
        {value}
      </SyntaxHighlighter>
    </Box>
  );
};

YamlViewer.displayName = 'YamlViewer';
