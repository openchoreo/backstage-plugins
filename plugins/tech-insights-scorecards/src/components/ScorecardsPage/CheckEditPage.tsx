import { useState } from 'react';
import { useApi, useApiHolder } from '@backstage/core-plugin-api';
import { toastApiRef } from '@backstage/frontend-plugin-api';
import { checkAuthoringAssistantApiRef } from '../../api/CheckAuthoringAssistantApi';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import type { DynamicCheck, FactSchema } from '../../api/types';
import { useEntityLabel } from '../../utils/kinds';
import { CheckForm } from '../Checks/CheckForm';
import { FullPageView } from '../FullPageView';

interface CheckEditPageProps {
  check: DynamicCheck | null;
  factSchemas: FactSchema[];
  existingCategories: string[];
  onBack: () => void;
  onSaved: (check: DynamicCheck) => void;
  onPublished: () => void;
  /** Called after the assistant saves the check. */
  onChecksChanged?: () => void;
}

/**
 * Full-page create/edit view, swapped in by ScorecardsPage in place of the
 * checks table. Save and Publish stay inside CheckForm, so Cancel, the back
 * arrow and Esc all leave the editor the same way.
 */
export function CheckEditPage(props: CheckEditPageProps) {
  const {
    check: initialCheck,
    factSchemas,
    existingCategories,
    onBack,
    onSaved,
    onPublished,
    onChecksChanged,
  } = props;
  const entityLabel = useEntityLabel();
  const api = useApi(dynamicChecksApiRef);
  const toastApi = useApi(toastApiRef);

  // Optional: only present when a host app installs a check-authoring assistant.
  const assistant = useApiHolder().get(checkAuthoringAssistantApiRef);

  const [check, setCheck] = useState(initialCheck);
  // Part of the form's key: the form copies the check into its state only once.
  const [revision, setRevision] = useState(0);

  // The assistant saves without going through the form, so reload the form;
  // a later Save would otherwise overwrite the assistant's change.
  async function reloadCheck() {
    onChecksChanged?.();
    try {
      const checks = await api.listChecks();
      const saved = checks.find(c => c.id === initialCheck?.id);
      if (saved) {
        setCheck(saved);
        setRevision(current => current + 1);
      }
    } catch (e) {
      toastApi.post({
        title: `Couldn't reload the check. Reopen it before saving: ${
          (e as Error).message
        }`,
        status: 'danger',
      });
    }
  }

  return (
    <FullPageView
      title={check ? `Edit check: ${check.name}` : 'New check'}
      subtitle={`Define the check, dry-run it against a sample ${entityLabel.singular}, then save or publish.`}
      actions={
        assistant && check ? (
          <assistant.LaunchButton
            factSchemas={factSchemas}
            check={check}
            onChecksChanged={reloadCheck}
          />
        ) : undefined
      }
      onBack={onBack}
    >
      <CheckForm
        key={`${check?.id ?? 'new'}:${revision}`}
        check={check}
        factSchemas={factSchemas}
        existingCategories={existingCategories}
        onSaved={onSaved}
        onPublished={onPublished}
        showTitle={false}
        onCancel={onBack}
      />
    </FullPageView>
  );
}
