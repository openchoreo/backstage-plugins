import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { FormYamlToggle } from '@openchoreo/backstage-design-system';
import { JSONSchema7 } from 'json-schema';
import YAML from 'yaml';
import { YamlEditor } from '../YamlEditor';
import { buildYamlString } from '../../utils/jsonSchemaYaml';
import { useStyles } from './styles';

/**
 * How long to coalesce keystrokes before pushing the parsed YAML to the
 * parent.  The parent typically re-runs ajv schema validation in a
 * useEffect keyed on `parameters`, which is non-trivial for big schemas —
 * debouncing keeps typing responsive while still flushing well before the
 * user can act on a disabled Save/Add button (focus loss flushes
 * immediately, see `handleYamlBlur`).
 */
const FLUSH_DEBOUNCE_MS = 150;

export interface TraitConfigToggleProps {
  schema?: JSONSchema7;
  formData: Record<string, any>;
  onChange: (formData: Record<string, any>) => void;
  /** Called whenever YAML validity changes so the parent can disable Save/Add. */
  onValidityChange?: (isValid: boolean) => void;
  children: ReactNode;
}

export const TraitConfigToggle = ({
  schema,
  formData,
  onChange,
  onValidityChange,
  children,
}: TraitConfigToggleProps) => {
  const classes = useStyles();
  const [mode, setMode] = useState<'form' | 'yaml'>('yaml');
  const [yamlContent, setYamlContent] = useState<string>(() =>
    buildYamlString(schema, formData),
  );
  const [yamlError, setYamlError] = useState<string | undefined>();

  /** Pending debounced flush — timer id and the parsed value waiting to ship. */
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingParsed = useRef<Record<string, any> | null>(null);

  /** Try to parse YAML content; returns the parsed object or undefined on failure. */
  const parseYaml = useCallback(
    (content: string): Record<string, any> | undefined => {
      try {
        const parsed = YAML.parse(content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
        return undefined;
      } catch {
        return undefined;
      }
    },
    [],
  );

  /**
   * Send the latest parsed YAML to the parent right now, skipping the
   * debounce wait.
   *
   * Normally `handleYamlChange` waits FLUSH_DEBOUNCE_MS after the last
   * keystroke before calling `onChange`.  At certain moments — focus
   * leaving the editor (the user is about to click Save/Add), switching
   * to form view (the form reads from parent state) — that wait is too
   * long, so we cancel the timer and call `onChange` immediately with
   * whatever the latest parse produced.  If no edit is pending, this is
   * a no-op.
   */
  const sendPendingChangeNow = useCallback(() => {
    if (flushTimer.current !== null) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const buffered = pendingParsed.current;
    if (buffered !== null) {
      pendingParsed.current = null;
      onChange(buffered);
    }
  }, [onChange]);

  // Clear the debounce timer on unmount so we don't onChange into a
  // gone-away parent.
  useEffect(() => {
    return () => {
      if (flushTimer.current !== null) clearTimeout(flushTimer.current);
    };
  }, []);

  const handleModeChange = useCallback(
    (newMode: 'form' | 'yaml') => {
      if (newMode === mode) return;

      if (newMode === 'yaml') {
        setYamlContent(buildYamlString(schema, formData));
        setYamlError(undefined);
        onValidityChange?.(true);
      } else {
        // Switching to form — block if YAML is invalid
        const parsed = parseYaml(yamlContent);
        if (parsed) {
          pendingParsed.current = parsed;
          sendPendingChangeNow();
          setYamlError(undefined);
          onValidityChange?.(true);
        } else {
          setYamlError('YAML must be a valid object to switch to form view');
          return;
        }
      }
      setMode(newMode);
    },
    [
      mode,
      schema,
      formData,
      yamlContent,
      onValidityChange,
      parseYaml,
      sendPendingChangeNow,
    ],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      const parsed = parseYaml(content);
      if (parsed) {
        setYamlError(undefined);
        onValidityChange?.(true);
        // Coalesce keystrokes — see FLUSH_DEBOUNCE_MS doc.  Blur and mode
        // switch flush synchronously so disabled-button state can't lag
        // behind the user.
        pendingParsed.current = parsed;
        if (flushTimer.current !== null) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(() => {
          flushTimer.current = null;
          if (pendingParsed.current !== null) {
            const next = pendingParsed.current;
            pendingParsed.current = null;
            onChange(next);
          }
        }, FLUSH_DEBOUNCE_MS);
      } else {
        setYamlError('Invalid YAML: must be a valid YAML object');
        onValidityChange?.(false);
      }
    },
    [onChange, onValidityChange, parseYaml],
  );

  /** Flush valid YAML to the parent when focus leaves the editor container. */
  const yamlContainerRef = useRef<HTMLDivElement>(null);
  const handleYamlBlur = useCallback(
    (e: React.FocusEvent) => {
      // Only flush when focus actually leaves the container,
      // not when it moves between elements inside (e.g. editor ↔ toolbar).
      if (
        yamlContainerRef.current &&
        e.relatedTarget instanceof Node &&
        yamlContainerRef.current.contains(e.relatedTarget)
      ) {
        return;
      }
      sendPendingChangeNow();
    },
    [sendPendingChangeNow],
  );

  return (
    <div>
      <div className={classes.toggleContainer}>
        <FormYamlToggle value={mode} onChange={handleModeChange} />
      </div>

      {mode === 'form' ? (
        children
      ) : (
        <div
          ref={yamlContainerRef}
          className={classes.yamlContainer}
          onBlur={handleYamlBlur}
        >
          <YamlEditor
            content={yamlContent}
            onChange={handleYamlChange}
            errorText={yamlError}
          />
        </div>
      )}
    </div>
  );
};
