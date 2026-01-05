import { Fragment } from 'react';
import { Link } from '@backstage/core-components';
import { useEntityLinkContext } from './EntityLinkContext';

interface FormattedTextProps {
  text: string;
  /** When true, renders entities as bold text instead of clickable links */
  disableLinks?: boolean;
}

// Single pattern to match any {{tag:value}} format
const TAG_PATTERN = /\{\{(\w+):([^}]+)\}\}/;

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

/**
 * Component that renders text with:
 * - {{comp|env|proj:uuid}} patterns replaced by entity links
 * - {{ts:ISO_TIMESTAMP}} patterns replaced by formatted timestamps
 */
export const FormattedText = ({
  text,
  disableLinks = false,
}: FormattedTextProps) => {
  const { entityMap, loading } = useEntityLinkContext();

  // Split by any {{tag:value}} pattern, keeping delimiters
  const parts = text.split(/(\{\{\w+:[^}]+\}\})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(TAG_PATTERN);
        if (!match) {
          return <Fragment key={index}>{part}</Fragment>;
        }

        const [, tag, value] = match;

        switch (tag.toLowerCase()) {
          case 'comp':
          case 'env':
          case 'proj': {
            const entityInfo = entityMap.get(value);
            if (loading) {
              return <Fragment key={index}>...</Fragment>;
            }
            const displayText = entityInfo
              ? entityInfo.title || entityInfo.name
              : value;
            if (disableLinks || !entityInfo) {
              return <strong key={index}>{displayText}</strong>;
            }
            return (
              <Link key={index} to={entityInfo.path}>
                <strong>{displayText}</strong>
              </Link>
            );
          }
          case 'ts':
            return <strong key={index}>{formatTimestamp(value)}</strong>;
          default:
            return <Fragment key={index}>{part}</Fragment>;
        }
      })}
    </>
  );
};
