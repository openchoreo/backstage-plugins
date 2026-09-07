import {
  FormFieldBlueprint,
  createFormField,
} from '@backstage/plugin-scaffolder-react/alpha';

export const WorkloadDetailsFieldExtension = FormFieldBlueprint.make({
  name: 'workload-details-field',
  params: {
    field: () =>
      import('./WorkloadDetailsField').then(m =>
        createFormField({
          name: 'WorkloadDetailsField',
          component: m.WorkloadDetailsField,
          schema: m.WorkloadDetailsFieldSchema as any,
          validation: m.workloadDetailsFieldValidation,
        }),
      ),
  },
});
