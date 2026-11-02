import { useMemo } from 'react';
import { EmptyState, InfoCard, Progress } from '@backstage/core-components';
import { kindSummaries } from '../../breakdown';
import { useEntityLabel, useKindLabel } from '../../kinds';
import { FullPageView } from '../FullPageView';
import { LoadErrorState } from '../LoadErrorState';
import { hasOwnChecks, KindScores } from './KindScores';
import type { CatalogScores } from './useScoreResults';

interface ScoreBreakdownProps {
  title: string;
  results?: CatalogScores;
  loading: boolean;
  error?: Error;
  onBack: () => void;
  onRetry: () => void;
}

/**
 * The catalog's scores by kind. Only kinds with checks of
 * their own are listed; a kind whose tiers only combine what belongs to it,
 * such as System, is left to its entities' tabs.
 */
export function ScoreBreakdown({
  title,
  results,
  loading,
  error,
  onBack,
  onRetry,
}: ScoreBreakdownProps) {
  const kindLabel = useKindLabel();
  const entityLabel = useEntityLabel();

  const entities = useMemo(() => results?.entities ?? [], [results]);
  const summaries = useMemo(
    () =>
      kindSummaries(entities, results?.kinds ?? [])
        .filter(hasOwnChecks)
        .sort((a, b) => kindLabel(a.kind).localeCompare(kindLabel(b.kind))),
    [entities, results, kindLabel],
  );

  let content;
  if (loading) {
    content = <Progress />;
  } else if (error) {
    content = (
      <LoadErrorState
        title="Couldn't load scores"
        error={error}
        onRetry={onRetry}
      />
    );
  } else if (summaries.length === 0) {
    content = (
      <EmptyState
        missing="data"
        title="Nothing to score yet"
        description={`Scores appear here once a published check runs against ${entityLabel.plural}.`}
      />
    );
  } else {
    content = (
      <InfoCard noPadding>
        <KindScores summaries={summaries} />
      </InfoCard>
    );
  }

  return (
    <FullPageView
      title={`${title} breakdown`}
      subtitle={`Pass rates and tiers for each kind of ${entityLabel.singular}.`}
      onBack={onBack}
    >
      {content}
    </FullPageView>
  );
}
