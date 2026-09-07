import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const BuildAndDeployFieldExtension = FormFieldBlueprint.make({
  name: 'build-and-deploy-field',
  params: {
    field: () =>
      import('./BuildAndDeployField').then(m =>
        createFormField({
          name: 'BuildAndDeployField',
          component: m.BuildAndDeployField,
          schema: m.BuildAndDeployFieldSchema as any,
        }),
      ),
  },
});
