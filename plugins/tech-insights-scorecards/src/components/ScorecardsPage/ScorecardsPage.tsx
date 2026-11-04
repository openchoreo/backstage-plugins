import { useState } from 'react';
import Box from '@material-ui/core/Box';
import {
  Content,
  EmptyState,
  Header,
  Page,
  Progress,
} from '@backstage/core-components';
import type { DynamicCheck, FactSchema } from '../../api/types';
import { CheckPolicyTable } from '../Checks/CheckPolicyTable';
import { FactCollectorsPanel } from '../FactCollectorsPanel';
import { useCheckPermissions } from '../useCheckPermissions';
import { CheckEditPage } from './CheckEditPage';

type View = 'checks' | 'editCheck';

export interface ScorecardsPageProps {
  /** Page heading, from the page extension's `title` config. */
  title: string;
}

/**
 * The catalog-wide scorecard page: the checks table and Data sources panel.
 * "New check"/edit swaps in a full-page editor through local state rather
 * than a sub-route.
 */
export function ScorecardsPage({ title }: ScorecardsPageProps) {
  const [view, setView] = useState<View>('checks');
  const [editingCheck, setEditingCheck] = useState<DynamicCheck | null>(null);
  const [editingFactSchemas, setEditingFactSchemas] = useState<FactSchema[]>(
    [],
  );
  const [editingCategories, setEditingCategories] = useState<string[]>([]);
  const permissions = useCheckPermissions();
  const canView = !permissions.loading && permissions.canRead;

  function openEditor(
    check: DynamicCheck | null,
    factSchemas: FactSchema[],
    existingCategories: string[],
  ) {
    setEditingCheck(check);
    setEditingFactSchemas(factSchemas);
    setEditingCategories(existingCategories);
    setView('editCheck');
  }

  return (
    <Page themeId="tool">
      <Header title={title} />
      <Content>
        {permissions.loading && <Progress />}
        {!permissions.loading && !permissions.canRead && (
          <EmptyState
            missing="info"
            title="No access"
            description="You don't have permission to view checks."
          />
        )}
        {canView && view === 'checks' && (
          <>
            <CheckPolicyTable
              onNewCheck={(factSchemas, existingCategories) =>
                openEditor(null, factSchemas, existingCategories)
              }
              onEditCheck={(check, factSchemas, existingCategories) =>
                openEditor(check, factSchemas, existingCategories)
              }
            />
            <Box mt={2}>
              <FactCollectorsPanel />
            </Box>
          </>
        )}
        {canView && view === 'editCheck' && (
          <CheckEditPage
            check={editingCheck}
            factSchemas={editingFactSchemas}
            existingCategories={editingCategories}
            onBack={() => setView('checks')}
            onSaved={() => setView('checks')}
            onPublished={() => setView('checks')}
          />
        )}
      </Content>
    </Page>
  );
}
