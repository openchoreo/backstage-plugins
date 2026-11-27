import { useApiHolder } from '@backstage/core-plugin-api';
import { checkAuthoringAssistantsApiRef } from '../../api/CheckAuthoringAssistantApi';
import type { DynamicCheck, FactSchema } from '../../api/types';
import { useEntityLabel } from '../../utils/kinds';
import { CheckForm } from '../Checks/CheckForm';
import { useAssistantSavedCheck } from '../Checks/useAssistantSavedCheck';
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

  // Optional: only present when a host app installs a check-authoring assistant.
  const assistant = useApiHolder().get(
    checkAuthoringAssistantsApiRef,
  )?.assistant;

  const { check, revision, reloadCheck } = useAssistantSavedCheck(
    initialCheck,
    onChecksChanged,
  );

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
