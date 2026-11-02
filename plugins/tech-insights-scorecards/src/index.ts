/**
 * Scorecards over Tech Insights: check management and data sources.
 * The plugin itself is exported from `./alpha` for the New Frontend System.
 *
 * @packageDocumentation
 */

export { ScorecardsPage } from './components/ScorecardsPage';
export type { ScorecardsPageProps } from './components/ScorecardsPage';
export { CheckPolicyTable, CheckForm } from './components/Checks';
export { FactCollectorsPanel } from './components/FactCollectorsPanel';
export type { FactCollectorsPanelProps } from './components/FactCollectorsPanel';
export { TIER_LABEL, getTierColor, getFilledTierColors } from './tierPalette';
export { useTierLabel } from './components/useTierLabel';
export { TierChip } from './components/TierChip';
export type { TierChipProps } from './components/TierChip';
export { dynamicChecksApiRef } from './api/DynamicChecksApi';
export type { DynamicChecksApi } from './api/DynamicChecksApi';
export { DynamicChecksClient } from './api/DynamicChecksClient';
export type {
  CheckLink,
  CheckProblem,
  DynamicCheck,
  DynamicCheckInput,
  FactSchema,
  FactCollector,
  TriggerCollectionResult,
  DryRunResult,
  DryRunReason,
  DryRunStatus,
} from './api/types';
