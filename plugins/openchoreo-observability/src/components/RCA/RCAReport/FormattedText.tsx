import { Children, Fragment, useMemo, type ReactNode } from 'react';
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

// Entity tag patterns:
//   Raw form: <comp:name>, <proj:name>, <env:name>, <ns:name>
//   Escaped form: {{comp:name}}, {{proj:name}}, etc. (used after pre-processing for markdown safety)
const ENTITY_TAG_PATTERN = /(?:<|{{)(comp|proj|env|ns):([^>}]+)(?:>|}})/;

// ISO 8601 timestamp pattern (e.g., 2023-10-05T14:48:00Z or 2023-10-05T14:48:00.123456Z)
const ISO_TIMESTAMP_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;

// Combined pattern to split text by entity tags (both forms) and timestamps, keeping delimiters
const SPLIT_PATTERN =
  /((?:<|{{)(?:comp|proj|env|ns):[^>}]+(?:>|}})|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/g;

// Convert <tag:name> to {{tag:name}} so ReactMarkdown doesn't strip them as HTML
function escapeEntityTags(text: string): string {
  return text.replace(/<((?:comp|proj|env|ns):[^>]+)>/g, '{{$1}}');
}

// Map tag type to Backstage catalog kind
const TAG_TO_KIND: Record<string, string> = {
  comp: 'component',
  proj: 'system',
};

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
 * - Entity tags (<comp:name>, <proj:name>, etc.) replaced by catalog links
 * - ISO 8601 timestamps replaced by formatted dates
 */
export const FormattedText = ({
  text,
  disableLinks = false,
  disableMarkdown = false,
}: FormattedTextProps) => {
  const classes = useRCAReportStyles();
  const { namespace } = useEntityLinkContext();

  // Render a single text segment (entity tag, timestamp, or plain text)
  const renderSegment = (segment: string, index: number) => {
    const tagMatch = segment.match(ENTITY_TAG_PATTERN);
    if (tagMatch) {
      const [, tagType, name] = tagMatch;
      const kind = TAG_TO_KIND[tagType];
      if (!disableLinks && kind) {
        return (
          <Link
            key={index}
            to={`/catalog/${namespace}/${kind}/${name}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <strong>{name}</strong>
          </Link>
        );
      }
      return <strong key={index}>{name}</strong>;
    }

    if (ISO_TIMESTAMP_PATTERN.test(segment)) {
      return <strong key={index}>{formatTimestamp(segment)}</strong>;
    }

    return <Fragment key={index}>{segment}</Fragment>;
  };

  // Process React children, replacing string nodes with rendered segments
  const processChildren = (children: ReactNode): ReactNode => {
    return Children.map(children, child => {
      if (typeof child === 'string') {
        const parts = child.split(SPLIT_PATTERN);
        return <>{parts.map((part, i) => renderSegment(part, i))}</>;
      }
      return child;
    });
  };

  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: { children?: ReactNode }) => (
        <span>{processChildren(children)}</span>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong>{processChildren(children)}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => (
        <em>{processChildren(children)}</em>
      ),
      code: ({ children }: { children?: ReactNode }) => (
        <code>{processChildren(children)}</code>
      ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [namespace, disableLinks],
  );

  // Skip markdown processing for title-ish fields, strip any markdown syntax
  if (disableMarkdown) {
    const stripped = stripMarkdown(text);
    const parts = stripped.split(SPLIT_PATTERN);
    return <>{parts.map((part, i) => renderSegment(part, i))}</>;
  }

  // Escape entity tags before markdown parsing to prevent them from being stripped as HTML
  const safeText = escapeEntityTags(text);

  return (
    <span className={classes.markdownContent}>
      <ReactMarkdown components={markdownComponents}>{safeText}</ReactMarkdown>
    </span>
  );
};
