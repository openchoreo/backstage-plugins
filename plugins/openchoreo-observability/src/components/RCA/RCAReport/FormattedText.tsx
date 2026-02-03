import React, { Fragment, useMemo } from 'react';
import { Link } from '@backstage/core-components';
import ReactMarkdown from 'react-markdown';
import { useEntityLinkContext } from './EntityLinkContext';
import { useRCAReportStyles } from './styles';

interface FormattedTextProps {
  text: string;
  /** When true, renders entities as bold text instead of clickable links */
  disableLinks?: boolean;
  /** When true, skips markdown processing (for title-ish fields) */
  disableMarkdown?: boolean;
}

// UUID pattern (case-insensitive)
const UUID_PATTERN =
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

// ISO 8601 timestamp pattern (e.g., 2023-10-05T14:48:00Z or 2023-10-05T14:48:00.123Z)
const ISO_TIMESTAMP_PATTERN =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z/;

// Combined pattern to split text by UUIDs and timestamps, keeping delimiters
const SPLIT_PATTERN =
  /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)/gi;

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// Strip markdown syntax from text
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/__(.+?)__/g, '$1') // __bold__
    .replace(/\*(.+?)\*/g, '$1') // *italic*
    .replace(/_(.+?)_/g, '$1') // _italic_
    .replace(/`(.+?)`/g, '$1'); // `code`
}

/**
 * Renders text with:
 * - Inline markdown: bold (**), italic (*), code (`)
 * - UUIDs replaced by entity links (when found in catalog)
 * - ISO 8601 timestamps replaced by formatted dates
 */
export const FormattedText = ({
  text,
  disableLinks = false,
  disableMarkdown = false,
}: FormattedTextProps) => {
  const classes = useRCAReportStyles();
  const { entityMap, loading } = useEntityLinkContext();

  // Render a single text segment (UUID, timestamp, or plain text)
  const renderSegment = (segment: string, index: number) => {
    if (UUID_PATTERN.test(segment)) {
      const entityInfo = entityMap.get(segment);
      if (loading) {
        return <Fragment key={index}>...</Fragment>;
      }
      const displayText = entityInfo
        ? entityInfo.title || entityInfo.name
        : segment;
      if (disableLinks || !entityInfo) {
        return <strong key={index}>{displayText}</strong>;
      }
      return (
        <Link
          key={index}
          to={entityInfo.path}
          target="_blank"
          rel="noopener noreferrer"
        >
          <strong>{displayText}</strong>
        </Link>
      );
    }

    if (ISO_TIMESTAMP_PATTERN.test(segment)) {
      return <strong key={index}>{formatTimestamp(segment)}</strong>;
    }

    return <Fragment key={index}>{segment}</Fragment>;
  };

  // Process React children, replacing string nodes with rendered segments
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, child => {
      if (typeof child === 'string') {
        const parts = child.split(SPLIT_PATTERN);
        return <>{parts.map((part, i) => renderSegment(part, i))}</>;
      }
      return child;
    });
  };

  // Skip markdown processing for title-ish fields, strip any markdown syntax
  if (disableMarkdown) {
    const stripped = stripMarkdown(text);
    const parts = stripped.split(SPLIT_PATTERN);
    return <>{parts.map((part, i) => renderSegment(part, i))}</>;
  }

  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => (
        <span>{processChildren(children)}</span>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong>{processChildren(children)}</strong>
      ),
      em: ({ children }: { children?: React.ReactNode }) => (
        <em>{processChildren(children)}</em>
      ),
      code: ({ children }: { children?: React.ReactNode }) => (
        <code>{children}</code>
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityMap, loading, disableLinks],
  );

  return (
    <span className={classes.markdownContent}>
      <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
    </span>
  );
};
