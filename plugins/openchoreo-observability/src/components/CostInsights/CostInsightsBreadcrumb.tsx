import { FC } from 'react';
import { ScopeBreadcrumb } from '../ScopeBreadcrumb';
import type { CostScope } from './types';

export interface CostInsightsBreadcrumbProps {
  scope: CostScope;
  onScopeChange: (next: CostScope) => void;
}

/**
 * Cost Insights scope picker. The namespace/project/component picker itself is
 * shared with Delivery Insights (see `ScopeBreadcrumb`); this only pins the
 * cache-key prefix so both pages reuse the same catalog lookups.
 */
export const CostInsightsBreadcrumb: FC<CostInsightsBreadcrumbProps> = ({
  scope,
  onScopeChange,
}) => (
  <ScopeBreadcrumb
    scope={scope}
    onScopeChange={onScopeChange}
    queryKeyPrefix="insights-scope"
  />
);
