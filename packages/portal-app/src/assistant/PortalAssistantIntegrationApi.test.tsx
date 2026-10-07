import { PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import {
  portalAssistantIntegrationApiRef,
  usePortalAssistant,
} from './PortalAssistantIntegrationApi';

// Exercises every slot the way the shell consumes it: AppWrapper with a
// Fragment default, and conditional rendering for the optional notifier.
function Probe() {
  const {
    AppWrapper = ({ children }: PropsWithChildren<{}>) => <>{children}</>,
    BuildFailureNotifier,
  } = usePortalAssistant();
  return (
    <AppWrapper>
      {BuildFailureNotifier ? <BuildFailureNotifier /> : null}
      <span>content</span>
    </AppWrapper>
  );
}

describe('usePortalAssistant', () => {
  it('returns empty slots when no integration is registered', () => {
    render(
      <TestApiProvider apis={[]}>
        <Probe />
      </TestApiProvider>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByTestId('wrapper')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notifier')).not.toBeInTheDocument();
  });

  it('exposes the registered integration slots', () => {
    render(
      <TestApiProvider
        apis={[
          [
            portalAssistantIntegrationApiRef,
            {
              AppWrapper: ({ children }: PropsWithChildren<{}>) => (
                <div data-testid="wrapper">{children}</div>
              ),
              BuildFailureNotifier: () => <div data-testid="notifier" />,
            },
          ],
        ]}
      >
        <Probe />
      </TestApiProvider>,
    );
    // The wrapper wraps the content (not rendered beside it).
    expect(screen.getByTestId('wrapper')).toContainElement(
      screen.getByText('content'),
    );
    expect(screen.getByTestId('notifier')).toBeInTheDocument();
  });
});
