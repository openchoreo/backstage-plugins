import { Fragment } from 'react';
import { Link } from '@backstage/core-components';
import { makeStyles } from '@material-ui/core/styles';
import { useEntityLinkContext } from './EntityLinkContext';

interface Highlight {
  value: string;
  severity: 'critical' | 'warning' | 'normal';
}

interface FormattedTextProps {
  text: string;
  /** When true, renders entities as bold text instead of clickable links */
  disableLinks?: boolean;
  /** Optional highlights to apply inline styling to matching text */
  highlights?: Highlight[];
}

const useStyles = makeStyles(theme => ({
  highlightCritical: {
    fontWeight: 600,
    color: theme.palette.error.main,
  },
  highlightWarning: {
    fontWeight: 600,
    color: theme.palette.warning.main,
  },
  highlightNormal: {
    fontWeight: 600,
    color: theme.palette.success.main,
  },
}));

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
 * - Optional highlights applied to matching text
 */
export const FormattedText = ({
  text,
  disableLinks = false,
  highlights,
}: FormattedTextProps) => {
  const classes = useStyles();
  const { entityMap, loading } = useEntityLinkContext();

  const getHighlightClass = (severity: Highlight['severity']) => {
    switch (severity) {
      case 'critical':
        return classes.highlightCritical;
      case 'warning':
        return classes.highlightWarning;
      case 'normal':
        return classes.highlightNormal;
      default:
        return '';
    }
  };

  // Apply highlights to a plain text string
  const applyHighlights = (plainText: string, keyPrefix: string) => {
    if (!highlights || highlights.length === 0) {
      return <Fragment key={keyPrefix}>{plainText}</Fragment>;
    }

    // Build a regex pattern from all highlight values
    const escapedValues = highlights
      .map(h => h.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const highlightPattern = new RegExp(`(${escapedValues})`, 'g');

    const segments = plainText.split(highlightPattern);

    return (
      <Fragment key={keyPrefix}>
        {segments.map((segment, idx) => {
          const matchingHighlight = highlights.find(h => h.value === segment);
          if (matchingHighlight) {
            return (
              <span
                key={`${keyPrefix}-${idx}`}
                className={getHighlightClass(matchingHighlight.severity)}
              >
                {segment}
              </span>
            );
          }
          return <Fragment key={`${keyPrefix}-${idx}`}>{segment}</Fragment>;
        })}
      </Fragment>
    );
  };

  // Split by any {{tag:value}} pattern, keeping delimiters
  const parts = text.split(/(\{\{\w+:[^}]+\}\})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(TAG_PATTERN);
        if (!match) {
          return applyHighlights(part, `part-${index}`);
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
          case 'ts':
            return <strong key={index}>{formatTimestamp(value)}</strong>;
          default:
            return <Fragment key={index}>{part}</Fragment>;
        }
      })}
    </>
  );
};
