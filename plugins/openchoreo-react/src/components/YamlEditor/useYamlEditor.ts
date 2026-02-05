import { useState, useCallback, useEffect } from 'react';
import YAML from 'yaml';

export interface UseYamlEditorOptions {
  /** Initial content (JSON object or YAML string) */
  initialContent: Record<string, unknown> | string;
  /** Called when save is triggered with parsed JSON object */
  onSave?: (content: Record<string, unknown>) => Promise<void>;
  /** Called when delete is triggered */
  onDelete?: () => Promise<void>;
}

export interface UseYamlEditorResult {
  /** Current YAML content as string */
  content: string;
  /** Update the content */
  setContent: (content: string) => void;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether a delete operation is in progress */
  isDeleting: boolean;
  /** YAML parse error if any */
  parseError: string | undefined;
  /** Handle save action */
  handleSave: () => Promise<void>;
  /** Handle discard action (reset to initial content) */
  handleDiscard: () => void;
  /** Handle delete action */
  handleDelete: () => Promise<void>;
  /** Reset to new initial content */
  reset: (newContent: Record<string, unknown> | string) => void;
  /** Parse the current YAML content to JSON */
  parseYaml: () => Record<string, unknown> | null;
}

/**
 * Hook for managing YAML editor state.
 *
 * Handles:
 * - Dirty tracking (comparing against initial content)
 * - YAML parsing and validation
 * - Save/discard/delete operations with loading states
 * - Converting between JSON objects and YAML strings
 */
export function useYamlEditor({
  initialContent,
  onSave,
  onDelete,
}: UseYamlEditorOptions): UseYamlEditorResult {
  // Convert initial content to YAML string if it's an object
  const toYamlString = useCallback(
    (value: Record<string, unknown> | string): string => {
      if (typeof value === 'string') {
        return value;
      }
      return YAML.stringify(value, {
        indent: 2,
        lineWidth: 0, // Disable line wrapping
      });
    },
    [],
  );

  const [originalContent, setOriginalContent] = useState(() =>
    toYamlString(initialContent),
  );
  const [content, setContent] = useState(originalContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [parseError, setParseError] = useState<string | undefined>(undefined);

  // Update original content when initialContent prop changes
  useEffect(() => {
    const newOriginal = toYamlString(initialContent);
    setOriginalContent(newOriginal);
    setContent(newOriginal);
    setParseError(undefined);
  }, [initialContent, toYamlString]);

  // Check if content has changed
  const isDirty = content !== originalContent;

  // Validate YAML when content changes
  useEffect(() => {
    try {
      YAML.parse(content);
      setParseError(undefined);
    } catch (error) {
      if (error instanceof Error) {
        setParseError(`YAML Parse Error: ${error.message}`);
      } else {
        setParseError('Invalid YAML');
      }
    }
  }, [content]);

  // Parse current content to JSON
  const parseYaml = useCallback((): Record<string, unknown> | null => {
    try {
      return YAML.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [content]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave || !isDirty || parseError) {
      return;
    }

    const parsed = parseYaml();
    if (!parsed) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(parsed);
      // Update original content to current content after successful save
      setOriginalContent(content);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, isDirty, parseError, parseYaml, content]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setContent(originalContent);
    setParseError(undefined);
  }, [originalContent]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!onDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete]);

  // Reset to new content
  const reset = useCallback(
    (newContent: Record<string, unknown> | string) => {
      const newYaml = toYamlString(newContent);
      setOriginalContent(newYaml);
      setContent(newYaml);
      setParseError(undefined);
    },
    [toYamlString],
  );

  return {
    content,
    setContent,
    isDirty,
    isSaving,
    isDeleting,
    parseError,
    handleSave,
    handleDiscard,
    handleDelete,
    reset,
    parseYaml,
  };
}
