import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

type CreateFormFieldParams = Parameters<typeof createFormField>[0];
type FieldModule = Record<string, any>;

// Wraps the FormFieldBlueprint + createFormField + dynamic-import boilerplate
// that every OpenChoreo scaffolder field shares. Each field only needs to
// supply its kebab-case blueprint name, the module loader, and a picker that
// extracts the component (and optional schema / validation) from the module.
export function makeFormFieldExtension(
  blueprintName: string,
  loader: () => Promise<FieldModule>,
  build: (mod: FieldModule) => CreateFormFieldParams,
) {
  return FormFieldBlueprint.make({
    name: blueprintName,
    params: {
      field: () => loader().then(m => createFormField(build(m))),
    },
  });
}
