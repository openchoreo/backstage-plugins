import { fireEvent, render, screen } from '@testing-library/react';
import {
  PipelineFlowVisualization,
  type PipelineEnvironmentHook,
} from './PipelineFlowVisualization';

jest.mock('@backstage/core-components', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

// The DAG layout (used for non-linear pipelines) calls structuredClone, which
// this jsdom environment does not provide.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
}

const scan: PipelineEnvironmentHook = {
  key: 'pre-image-scan',
  name: 'image-scan',
  phase: 'pre',
  effect: 'blocks',
  to: '/catalog/openchoreo-cluster/clusterhook/trivy-image-scan',
};
const e2e: PipelineEnvironmentHook = {
  key: 'pre-e2e-test',
  name: 'e2e-test',
  phase: 'pre',
  effect: 'blocks',
};
const notify: PipelineEnvironmentHook = {
  key: 'post-print-message',
  name: 'print-message',
  phase: 'post',
  effect: 'background',
};

const open = (env: string) =>
  fireEvent.click(screen.getByTestId(`hooks-toggle-${env}`));

const linearPaths = [
  { source: 'dev', targets: [{ name: 'staging' }] },
  { source: 'staging', targets: [{ name: 'production' }] },
];

// Hooks belong to the environment and run for every deployment into it, so
// they are drawn in Before / After deploy lanes around the environment —
// never on an arrow, which would read as "runs during this promotion".
describe('PipelineFlowVisualization deployment hooks', () => {
  // The pipeline stays as compact as before; an environment with hooks only
  // shows how many it has until the user opens it.
  it('starts collapsed, showing a hook count per environment, and toggles open and shut', () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'staging', 'production']}
        promotionPaths={linearPaths}
        environmentHooks={{ staging: [scan], production: [scan, e2e, notify] }}
      />,
    );
    expect(screen.queryByTestId('hooks-pre-production')).toBeNull();
    expect(screen.queryByText('Before deploy')).toBeNull();
    const toggle = screen.getByTestId('hooks-toggle-production');
    expect(toggle).toHaveTextContent('3 hooks');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('hooks-toggle-staging')).toHaveTextContent(
      '1 hook',
    );
    // An environment without hooks gets no toggle.
    expect(screen.queryByTestId('hooks-toggle-dev')).toBeNull();

    open('production');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('hooks-pre-production')).toBeInTheDocument();
    // Blocks only: the phase is where a pill sits, not a text label.
    expect(screen.queryByText('Before deploy')).toBeNull();
    expect(screen.queryByText('Environments')).toBeNull();
    // Opening one environment leaves the others collapsed.
    expect(screen.queryByTestId('hooks-pre-staging')).toBeNull();

    open('production');
    expect(screen.queryByTestId('hooks-pre-production')).toBeNull();
    expect(screen.queryByText('Before deploy')).toBeNull();
  });

  it('puts pre-deploy hooks in the Before lane and post-deploy hooks in the After lane of their environment', () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'staging', 'production']}
        promotionPaths={linearPaths}
        environmentHooks={{
          staging: [scan, notify],
          production: [scan, e2e, notify],
        }}
      />,
    );
    open('staging');
    open('production');

    expect(screen.getByTestId('pipeline-hook-lanes')).toBeInTheDocument();

    const beforeProduction = screen.getByTestId('hooks-pre-production');
    expect(beforeProduction).toHaveTextContent('image-scan');
    expect(beforeProduction).toHaveTextContent('e2e-test');
    expect(beforeProduction).not.toHaveTextContent('print-message');
    expect(screen.getByTestId('hooks-post-production')).toHaveTextContent(
      'print-message',
    );
    expect(screen.getByTestId('hooks-pre-staging')).not.toHaveTextContent(
      'e2e-test',
    );
  });

  it('shows hooks on the root environment too', () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'staging']}
        promotionPaths={[{ source: 'dev', targets: [{ name: 'staging' }] }]}
        environmentHooks={{ dev: [scan, notify] }}
      />,
    );
    open('dev');
    expect(screen.getByTestId('hooks-pre-dev')).toHaveTextContent('image-scan');
    expect(screen.getByTestId('hooks-post-dev')).toHaveTextContent(
      'print-message',
    );
  });

  it('says what each hook does to the deployment and links to its entity', () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'staging']}
        promotionPaths={[{ source: 'dev', targets: [{ name: 'staging' }] }]}
        environmentHooks={{ staging: [scan, notify] }}
      />,
    );
    open('staging');
    const scanPill = screen.getByTestId('hook-pill-pre-image-scan');
    expect(scanPill).toHaveAttribute(
      'title',
      'Before deploy: image-scan — waits for it; a failure blocks the deployment',
    );
    expect(scanPill.closest('a')).toHaveAttribute('href', scan.to);
    expect(screen.getByTestId('hook-pill-post-print-message')).toHaveAttribute(
      'title',
      'After deploy: print-message — runs in the background; the deployment does not wait',
    );
    // No icons: the phase comes from the lane, the effect from the hover text.
    expect(scanPill.querySelector('svg')).toBeNull();
  });

  // Opening an environment must not move the cards: its hooks hang below its
  // card, pre-deploy first, instead of pushing the card down from above.
  it("shows an open environment's hooks below its card, pre-deploy before post-deploy", () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'staging']}
        promotionPaths={[{ source: 'dev', targets: [{ name: 'staging' }] }]}
        environmentHooks={{ staging: [scan, notify] }}
      />,
    );
    open('staging');
    const chip = screen.getByText('Staging');
    const toggle = screen.getByTestId('hooks-toggle-staging');
    const pre = screen.getByTestId('hooks-pre-staging');
    const post = screen.getByTestId('hooks-post-staging');
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(chip, toggle)).toBe(true);
    expect(follows(toggle, pre)).toBe(true);
    expect(follows(pre, post)).toBe(true);
    // All of it lives in the environment's own column.
    expect(chip.closest('[class*="laneCell"]')).toBe(
      pre.closest('[class*="laneCell"]'),
    );
  });

  it('ignores hooks of environments that are not in this pipeline', () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'staging']}
        promotionPaths={[{ source: 'dev', targets: [{ name: 'staging' }] }]}
        environmentHooks={{ 'other-env': [scan] }}
      />,
    );
    expect(screen.queryByTestId('pipeline-hook-lanes')).not.toBeInTheDocument();
  });

  it('draws hooks around each node of a non-linear pipeline once, not per incoming path', () => {
    render(
      <PipelineFlowVisualization
        environments={['dev', 'hotfix', 'production']}
        promotionPaths={[
          { source: 'dev', targets: [{ name: 'production' }] },
          { source: 'hotfix', targets: [{ name: 'production' }] },
        ]}
        environmentHooks={{ production: [scan, e2e, notify] }}
      />,
    );
    expect(screen.queryByTestId('pipeline-hook-lanes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hooks-pre-production')).toBeNull();
    open('production');
    expect(screen.getAllByTestId('hooks-pre-production')).toHaveLength(1);
    expect(
      screen.getByTestId('hooks-pre-production').querySelectorAll('[title]'),
    ).toHaveLength(2);
    expect(screen.getAllByTestId('hooks-post-production')).toHaveLength(1);
  });

  it('keeps the plain chip strip when no environment has hooks', () => {
    const { container } = render(
      <PipelineFlowVisualization
        environments={['dev', 'staging']}
        promotionPaths={[{ source: 'dev', targets: [{ name: 'staging' }] }]}
        environmentHooks={{}}
      />,
    );
    expect(container.querySelector('[data-testid^="hooks-"]')).toBeNull();
    expect(screen.queryByText('Before deploy')).not.toBeInTheDocument();
  });
});
