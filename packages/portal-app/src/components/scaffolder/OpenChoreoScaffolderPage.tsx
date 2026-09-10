import useAsync from 'react-use/esm/useAsync';
import { ScaffolderPage } from '@backstage/plugin-scaffolder';
import { formFieldsApiRef } from '@backstage/plugin-scaffolder-react/alpha';
import { useApi } from '@backstage/core-plugin-api';
import { Progress, ResponseErrorPanel } from '@backstage/core-components';
import { ScaffolderLayout } from '../../scaffolder/ScaffolderLayout';
import { CustomTemplateListPage } from './CustomTemplateListPage';
import { OpenChoreoTemplateOutputs } from './OpenChoreoTemplateOutputs';
import { CustomReviewStep } from '../../scaffolder/CustomReviewState';

// Loads FormFieldBlueprint contributions (registered by
// @openchoreo/backstage-plugin) via formFieldsApiRef and passes them as the
// `formFields` prop instead of the pre-NFS JSX-children pattern.
export function OpenChoreoScaffolderPage() {
  const formFieldsApi = useApi(formFieldsApiRef);
  const {
    value: formFields,
    loading,
    error,
  } = useAsync(() => formFieldsApi.loadFormFields(), [formFieldsApi]);
  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;
  return (
    <ScaffolderLayout>
      <ScaffolderPage
        headerOptions={{
          title: 'Create a new resource',
          subtitle:
            'Create new resources using standard templates in your organization',
        }}
        components={{
          EXPERIMENTAL_TemplateListPageComponent: CustomTemplateListPage,
          EXPERIMENTAL_TemplateOutputsComponent: OpenChoreoTemplateOutputs,
          ReviewStepComponent: CustomReviewStep,
        }}
        // formFields is accepted by the internal Router but omitted from
        // RouterProps' TS declaration; runtime handles it fine.
        {...({ formFields } as any)}
      />
    </ScaffolderLayout>
  );
}
