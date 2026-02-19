import { useState, useCallback, ReactNode } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import { JSONSchema7 } from 'json-schema';
import YAML from 'yaml';
import { YamlEditor } from '../YamlEditor';
import { useStyles } from './styles';

/**
 * Generate a default object from a JSON Schema by walking its properties
 * and using `default` values where specified, or type-appropriate placeholders.
 */
function generateDefaults(schema: JSONSchema7): Record<string, any> {
  if (schema.type !== 'object' || !schema.properties) {
    return {};
  }

  const result: Record<string, any> = {};

  for (const [key, propDef] of Object.entries(schema.properties)) {
    if (typeof propDef === 'boolean') continue;

    if (propDef.default !== undefined) {
      result[key] = propDef.default;
    } else {
      switch (propDef.type) {
        case 'string':
          result[key] = '';
          break;
        case 'number':
        case 'integer':
          result[key] = 0;
          break;
        case 'boolean':
          result[key] = false;
          break;
        case 'array':
          result[key] = [];
          break;
        case 'object':
          result[key] = generateDefaults(propDef);
          break;
        default:
          result[key] = null;
          break;
      }
    }
  }

  return result;
}

/**
 * Merge schema defaults with actual form data so that every schema property
 * appears in the YAML, but user-provided values take precedence.
 * Strips undefined values from formData so that cleared fields fall back
 * to schema defaults rather than overwriting them with undefined.
 */
function buildYamlData(
  schema: JSONSchema7 | undefined,
  formData: Record<string, any>,
): Record<string, any> {
  if (!schema) return formData || {};
  const defaults = generateDefaults(schema);
  const cleanData = Object.fromEntries(
    Object.entries(formData || {}).filter(([_, v]) => v !== undefined),
  );
  return { ...defaults, ...cleanData };
}

/**
 * Build a YAML string from merged data, annotating required fields with
 * an inline `# required` comment so the user knows what must be filled in.
 */
/**
 * Recursively walk a YAML document node and set QUOTE_DOUBLE on every
 * string scalar so the output always shows `key: "value"`.
 */
function quoteStrings(node: unknown): void {
  if (YAML.isScalar(node) && typeof node.value === 'string') {
    node.type = YAML.Scalar.QUOTE_DOUBLE;
  } else if (YAML.isMap(node)) {
    for (const item of node.items) {
      quoteStrings(item.value);
    }
  } else if (YAML.isSeq(node)) {
    for (const item of node.items) {
      quoteStrings(item);
    }
  }
}

function buildYamlString(
  schema: JSONSchema7 | undefined,
  formData: Record<string, any>,
): string {
  const data = buildYamlData(schema, formData);
  const doc = new YAML.Document(data);

  // Force double-quoted strings for consistency
  quoteStrings(doc.contents);

  if (schema?.required && doc.contents && 'items' in doc.contents) {
    const requiredSet = new Set(schema.required);
    for (const item of (doc.contents as YAML.YAMLMap).items) {
      if (
        YAML.isScalar(item.key) &&
        typeof item.key.value === 'string' &&
        requiredSet.has(item.key.value) &&
        YAML.isScalar(item.value)
      ) {
        item.value.comment = ' required';
      }
    }
  }

  return doc.toString({ indent: 2 });
}

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
    (_: unknown, newMode: 'form' | 'yaml' | null) => {
      if (!newMode || newMode === mode) return;

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
    [mode, schema, formData, yamlContent, onChange, onValidityChange, parseYaml],
  );

  const handleYamlChange = useCallback(
    (content: string) => {
      setYamlContent(content);
      const parsed = parseYaml(content);
      if (parsed) {
        setYamlError(undefined);
        onValidityChange?.(true);
        onChange(parsed);
      } else {
        setYamlError('Invalid YAML: must be a valid YAML object');
        onValidityChange?.(false);
      }
    },
    [onChange, onValidityChange, parseYaml],
  );

  return (
    <div>
      <div className={classes.toggleContainer}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton value="yaml" className={classes.toggleButton}>
            YAML
          </ToggleButton>
          <ToggleButton value="form" className={classes.toggleButton}>
            Form
          </ToggleButton>
        </ToggleButtonGroup>
      </div>

      {mode === 'form' ? (
        children
      ) : (
        <div className={classes.yamlContainer}>
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
