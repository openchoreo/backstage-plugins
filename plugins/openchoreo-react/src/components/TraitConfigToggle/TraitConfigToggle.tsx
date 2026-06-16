import { useState, useCallback, useRef, ReactNode } from 'react';
import { FormYamlToggle } from '@openchoreo/backstage-design-system';
import { JSONSchema7 } from 'json-schema';
import YAML from 'yaml';
import { YamlEditor } from '../YamlEditor';
import { buildYamlString } from '../../utils/jsonSchemaYaml';
import { useStyles } from './styles';

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
          onChange(parsed);
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
      onChange,
      onValidityChange,
      parseYaml,
    ],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      const parsed = parseYaml(content);
      if (parsed) {
        setYamlError(undefined);
        onValidityChange?.(true);
        // Propagate per keystroke so the parent can recompute schema validity
        // (e.g. enabling Save/Add when required fields become non-empty).
        // The RjsfForm child is unmounted in YAML mode, so this is cheap.
        onChange(parsed);
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
      const parsed = parseYaml(yamlContent);
      if (parsed) {
        onChange(parsed);
      }
    },
    [yamlContent, parseYaml, onChange],
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
