import type { DynamicCheck, FactSchema } from '../../api/types';
import { useEntityLabel } from '../../kinds';
import { CheckForm } from '../Checks/CheckForm';
import { FullPageView } from '../FullPageView';

interface CheckEditPageProps {
  check: DynamicCheck | null;
  factSchemas: FactSchema[];
  existingCategories: string[];
  onBack: () => void;
  onSaved: (check: DynamicCheck) => void;
  onPublished: () => void;
}

/**
 * Full-page create/edit view, swapped in by ScorecardsPage in place of the
 * checks table. Save and Publish stay inside CheckForm, so Cancel, the back
 * arrow and Esc all leave the editor the same way.
 */
export function CheckEditPage(props: CheckEditPageProps) {
  const {
    check,
    factSchemas,
    existingCategories,
    onBack,
    onSaved,
    onPublished,
  } = props;
  const entityLabel = useEntityLabel();

  return (
    <FullPageView
      title={check ? `Edit check: ${check.name}` : 'New check'}
      subtitle={`Define the check, dry-run it against a sample ${entityLabel.singular}, then save or publish.`}
      onBack={onBack}
    >
      <CheckForm
        key={check?.id ?? 'new'}
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
