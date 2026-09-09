import { render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import {
  BuildFailureNotifierSlot,
  portalAssistantIntegrationApiRef,
} from './assistantIntegration';

describe('BuildFailureNotifierSlot', () => {
  it('renders nothing when no integration is registered', () => {
    const { container } = render(
      <TestApiProvider apis={[]}>
        <BuildFailureNotifierSlot />
      </TestApiProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the integration fills no notifier slot', () => {
    const { container } = render(
      <TestApiProvider apis={[[portalAssistantIntegrationApiRef, {}]]}>
        <BuildFailureNotifierSlot />
      </TestApiProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the registered notifier', () => {
    render(
      <TestApiProvider
        apis={[
          [
            portalAssistantIntegrationApiRef,
            { BuildFailureNotifier: () => <div data-testid="notifier" /> },
          ],
        ]}
      >
        <BuildFailureNotifierSlot />
      </TestApiProvider>,
    );
    expect(screen.getByTestId('notifier')).toBeInTheDocument();
  });
});
