import { sanitizeLabel } from '@openchoreo/backstage-plugin-common';

// Vendor extension carrying an RJSF uiSchema fragment for a schema node.
// Ref - https://github.com/openchoreo/openchoreo/blob/main/docs/templating/openapiv3-schema.md#vendor-extensions-x-
const PORTAL_UI_EXTENSION = 'x-openchoreo-backstage-portal';

// Portal values win; ui:options is merged so generated options (hideError) survive.
function mergePortalUiSchema(base: any, portal: any): any {
  const merged = { ...base, ...portal };
  if (base['ui:options'] || portal['ui:options']) {
    merged['ui:options'] = {
      ...base['ui:options'],
      ...portal['ui:options'],
    };
  }
  return merged;
}

// Builds an RJSF uiSchema: sanitized titles plus any x-openchoreo-backstage-portal
// fragments folded in (which take precedence over the generated defaults).
export function generateUiSchemaWithTitles(
  schema: any,
  hideErrors: boolean = false,
): any {
  if (!schema || typeof schema !== 'object') {
    return {};
  }

  const uiSchema: any = {};

  // Fragment on this object node (e.g. ui:order).
  if (
    schema[PORTAL_UI_EXTENSION] &&
    typeof schema[PORTAL_UI_EXTENSION] === 'object'
  ) {
    Object.assign(uiSchema, schema[PORTAL_UI_EXTENSION]);
  }

  if (schema.properties) {
    Object.entries(schema.properties).forEach(
      ([key, propSchema]: [string, any]) => {
        if (!propSchema || typeof propSchema !== 'object') {
          return;
        }

        const fieldUiSchema: any = {};

        if (!propSchema.title) {
          fieldUiSchema['ui:title'] = sanitizeLabel(key);
        }

        if (hideErrors) {
          fieldUiSchema['ui:options'] = {
            ...fieldUiSchema['ui:options'],
            hideError: true,
          };
        }

        uiSchema[key] = fieldUiSchema;

        // Objects fold their own fragment via recursion; leaves/arrays fold theirs here.
        if (propSchema.type === 'object' && propSchema.properties) {
          const nestedUiSchema = generateUiSchemaWithTitles(
            propSchema,
            hideErrors,
          );
          uiSchema[key] = {
            ...uiSchema[key],
            ...nestedUiSchema,
          };
        } else {
          const portal = propSchema[PORTAL_UI_EXTENSION];
          if (portal && typeof portal === 'object') {
            uiSchema[key] = mergePortalUiSchema(uiSchema[key], portal);
          }
        }

        // Array items keep their generated uiSchema under `items`.
        if (propSchema.type === 'array' && propSchema.items) {
          const itemsUiSchema = generateUiSchemaWithTitles(
            propSchema.items,
            hideErrors,
          );
          if (Object.keys(itemsUiSchema).length > 0) {
            uiSchema[key] = {
              ...uiSchema[key],
              items: itemsUiSchema,
            };
          }
        }
      },
    );
  }

  return uiSchema;
}
