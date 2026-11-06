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
import { useEntityLabel } from '../../kinds';
import { CheckPolicyTable } from '../Checks/CheckPolicyTable';
import { FactCollectorsPanel } from '../FactCollectorsPanel';
import { useCheckPermissions } from '../useCheckPermissions';
import { CheckEditPage } from './CheckEditPage';
import { ScoreBreakdown } from './ScoreBreakdown';
import { ScoreSummaryCard } from './ScoreSummaryCard';
import { useScoreResults } from './useScoreResults';

type View = 'checks' | 'breakdown' | 'editCheck';

export interface ScorecardsPageProps {
  /** Page heading, from the page extension's `title` config. */
  title: string;
  /**
   * Entity kinds the overview scores. Without it, every kind a published
   * check applies to.
   */
  kinds?: string[];
  /**
   * Shows the checks table and Data sources panel. Turn off when checks are
   * not stored by the dynamic-checks backend module.
   */
  showChecks: boolean;
}

/**
 * The catalog-wide scorecard page: a pass-rate summary, then the checks
 * table and Data sources panel. "View full breakdown" and "New check"/edit
 * swap in full-page views through local state rather than sub-routes. Each
 * entity's own results live on its scorecard tab.
 */
export function ScorecardsPage({
  title,
  kinds,
  showChecks,
}: ScorecardsPageProps) {
  const [view, setView] = useState<View>('checks');
  const [editingCheck, setEditingCheck] = useState<DynamicCheck | null>(null);
  const [editingFactSchemas, setEditingFactSchemas] = useState<FactSchema[]>(
    [],
  );
  const [editingCategories, setEditingCategories] = useState<string[]>([]);
  const [scoreRefreshKey, setScoreRefreshKey] = useState(0);
  const permissions = useCheckPermissions();
  const entityLabel = useEntityLabel();
  // Scores come from tech-insights itself, which enforces its own
  // permissions. The dynamic-checks read permission gates the page only
  // where that module stores the checks: a portal without it has nothing
  // to grant the permission for.
  const checkingPermission = showChecks && permissions.loading;
  const denied = showChecks && !permissions.loading && !permissions.canRead;
  const canView = !checkingPermission && !denied;
  const results = useScoreResults(kinds, scoreRefreshKey, canView);
  const refreshScores = () => setScoreRefreshKey(key => key + 1);
  const checksVisible = showChecks && canView;

  function leaveEditor() {
    setView('checks');
    refreshScores();
  }

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
        {checkingPermission && <Progress />}
        {denied && (
          <EmptyState
            missing="info"
            title="No access"
            description={`You don't have permission to view scores and checks across all ${entityLabel.plural}. Each ${entityLabel.singular}'s own scorecard is on its page.`}
          />
        )}
        {canView && view === 'checks' && (
          <>
            <Box mb={2}>
              <ScoreSummaryCard
                results={results.value}
                loading={results.loading}
                error={results.error}
                onViewBreakdown={() => setView('breakdown')}
              />
            </Box>
            {checksVisible && (
              <>
                <CheckPolicyTable
                  onNewCheck={(factSchemas, existingCategories) =>
                    openEditor(null, factSchemas, existingCategories)
                  }
                  onEditCheck={(check, factSchemas, existingCategories) =>
                    openEditor(check, factSchemas, existingCategories)
                  }
                  onChecksChanged={refreshScores}
                />
                <Box mt={2}>
                  <FactCollectorsPanel onCollected={refreshScores} />
                </Box>
              </>
            )}
          </>
        )}
        {canView && view === 'breakdown' && (
          <ScoreBreakdown
            title={title}
            results={results.value}
            loading={results.loading}
            error={results.error}
            onBack={() => setView('checks')}
            onRetry={refreshScores}
          />
        )}
        {canView && view === 'editCheck' && (
          <CheckEditPage
            check={editingCheck}
            factSchemas={editingFactSchemas}
            existingCategories={editingCategories}
            onBack={() => setView('checks')}
            onSaved={leaveEditor}
            onPublished={leaveEditor}
          />
        )}
      </Content>
    </Page>
  );
}
