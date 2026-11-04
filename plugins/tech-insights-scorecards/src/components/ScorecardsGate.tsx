import type { ReactNode } from 'react';
import { Content, EmptyState, Header, Page } from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

/** The config key a host sets to false to turn Scorecards off. */
export const ENABLED_CONFIG_KEY = 'techInsights.scorecards.enabled';

/** Whether Scorecards is on: `techInsights.scorecards.enabled`, default true. */
export function useScorecardsEnabled(): boolean {
  return useApi(configApiRef).getOptionalBoolean(ENABLED_CONFIG_KEY) ?? true;
}

export interface ScorecardsGateProps {
  children: ReactNode;
  /** Wraps the notice in a page with this heading, for a routed page. */
  pageTitle?: string;
}

/**
 * Renders its children only while Scorecards is on, so nothing under it
 * calls the Tech Insights backend, which a host that turns Scorecards off
 * doesn't run. Turned off, it shows a notice in their place.
 */
export function ScorecardsGate({ children, pageTitle }: ScorecardsGateProps) {
  const enabled = useScorecardsEnabled();
  if (enabled) return <>{children}</>;

  const notice = (
    <EmptyState
      missing="info"
      title="Scorecards is turned off"
      description={`Scorecards isn't enabled in this portal. An administrator can turn it on with ${ENABLED_CONFIG_KEY}.`}
    />
  );
  if (pageTitle === undefined) return notice;
  return (
    <Page themeId="tool">
      <Header title={pageTitle} />
      <Content>{notice}</Content>
    </Page>
  );
}
