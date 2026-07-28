import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import {
  TraitYamlEditorExtension,
  traitYamlEditorValidation,
} from './TraitYamlEditorExtension';

export const TraitYamlEditorFieldExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'TraitYamlEditor',
    component: TraitYamlEditorExtension,
    validation: traitYamlEditorValidation,
  }),
);
