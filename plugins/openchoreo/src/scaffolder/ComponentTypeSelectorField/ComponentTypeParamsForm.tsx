import { JSONSchema7 } from 'json-schema';
import { RjsfForm } from '@openchoreo/backstage-design-system';
import { generateUiSchemaWithTitles } from '../utils/rjsfUtils';

interface Props {
  schema: JSONSchema7;
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  /** Remounts the form when the selected type changes. */
  resetKey: string;
}

/** Renders a component type's inputParametersSchema as an embedded RJSF form. */
export const ComponentTypeParamsForm = ({
  schema,
  formData,
  onChange,
  resetKey,
}: Props) => (
  <RjsfForm
    key={resetKey}
    schema={schema as any}
    uiSchema={generateUiSchemaWithTitles(schema)}
    formData={formData}
    onChange={(e: any) => onChange(e.formData)}
    tagName="div"
  />
);
