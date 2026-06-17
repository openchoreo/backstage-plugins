import { fireEvent, render, screen } from '@testing-library/react';
import { InvestigateDependencyButton } from './InvestigateDependencyButton';
import type { ChatScope } from '../../api/PerchAgentApi';

// Hoisted shared spies — Jest hoists jest.mock above imports, so the
// factories below cannot close over outer variables. We dereference the
// holder at call time instead. (Same pattern as InvestigateLogButton.test.)
const holder: {
  enabled: boolean;
  openDrawer: jest.Mock;
  warmup: jest.Mock;
} = {
  enabled: true,
  openDrawer: jest.fn(),
  warmup: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@backstage/core-plugin-api', () => ({
  // PerchAgentApi.ts calls createApiRef at module load — keep a real-ish
  // stub so the import doesn't blow up during test setup.
  createApiRef: (config: { id: string }) => ({ id: config.id }),
  useApi: () => ({ warmup: (...args: unknown[]) => holder.warmup(...args) }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAssistantEnabled: () => holder.enabled,
}));

jest.mock('../AssistantContext/AssistantDrawerContext', () => ({
  useAssistantDrawer: () => ({
    openDrawer: (...args: unknown[]) => holder.openDrawer(...args),
  }),
}));

type DrawerCall = {
  scopeOverrides: Partial<ChatScope>;
  conversationKey: string;
  suggestions?: string[];
  initialMessage?: string;
};

const firstCall = () => holder.openDrawer.mock.calls[0][0] as DrawerCall;

beforeEach(() => {
  holder.enabled = true;
  holder.openDrawer = jest.fn();
  holder.warmup = jest.fn().mockResolvedValue(undefined);
});

describe('InvestigateDependencyButton', () => {
  it('renders nothing when the assistant feature is disabled', () => {
    holder.enabled = false;
    const { container } = render(
      <InvestigateDependencyButton
        component="snip-frontend"
        environment="development"
        status="Pending"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the labelled button when enabled', () => {
    render(
      <InvestigateDependencyButton
        component="snip-frontend"
        status="Pending"
      />,
    );
    const button = screen.getByRole('button', {
      name: /investigate this with portal assistant/i,
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Investigate with AI');
  });

  it('opens the drawer with a status-aware dependency_pending suggestion chip', () => {
    render(
      <InvestigateDependencyButton
        namespace="default"
        project="url-shortener"
        component="snip-frontend"
        environment="development"
        caseType="dependency_pending"
        status="Pending"
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(holder.openDrawer).toHaveBeenCalledTimes(1);
    const call = firstCall();
    expect(call.scopeOverrides).toEqual({
      caseType: 'dependency_pending',
      namespace: 'default',
      project: 'url-shortener',
      component: 'snip-frontend',
      environment: 'development',
    });
    expect(call.suggestions).toEqual([
      "Why is snip-frontend's development deployment Pending?",
      'Which dependency is it waiting on?',
    ]);
    // Suggestion path does not also pre-draft a composer message.
    expect(call.initialMessage).toBeUndefined();
    expect(call.conversationKey).toBe(
      'dependency_pending:default:url-shortener:snip-frontend:development',
    );
  });

  it('uses a root-cause follow-up suggestion for the runtime_debug case', () => {
    render(
      <InvestigateDependencyButton
        namespace="default"
        component="snip-frontend"
        environment="development"
        caseType="runtime_debug"
        status="Failed"
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    const call = firstCall();
    expect(call.scopeOverrides.caseType).toBe('runtime_debug');
    expect(call.suggestions).toEqual([
      "Why is snip-frontend's development deployment Failed?",
      'What is the root cause?',
    ]);
    expect(call.conversationKey.startsWith('runtime_debug:')).toBe(true);
  });

  it('defaults caseType to dependency_pending when not provided', () => {
    render(
      <InvestigateDependencyButton
        component="snip-frontend"
        status="Pending"
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    const call = firstCall();
    expect(call.scopeOverrides.caseType).toBe('dependency_pending');
    // No environment → status suggestion omits the env segment.
    expect(call.suggestions?.[0]).toBe(
      "Why is snip-frontend's deployment Pending?",
    );
  });

  it('omits scope fields that were not supplied', () => {
    render(
      <InvestigateDependencyButton
        component="snip-frontend"
        status="Pending"
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    const { scopeOverrides } = firstCall();
    expect(scopeOverrides).toEqual({
      caseType: 'dependency_pending',
      component: 'snip-frontend',
    });
    expect(scopeOverrides.namespace).toBeUndefined();
    expect(scopeOverrides.project).toBeUndefined();
    expect(scopeOverrides.environment).toBeUndefined();
  });

  it('falls back to a pre-drafted message when no status is provided', () => {
    render(
      <InvestigateDependencyButton
        namespace="default"
        component="snip-frontend"
        environment="development"
        caseType="dependency_pending"
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    const call = firstCall();
    expect(call.suggestions).toBeUndefined();
    expect(call.initialMessage).toBe(
      'Why is `snip-frontend` in `development` stuck pending?',
    );
    expect(call.conversationKey).toBe(
      'dependency_pending:default:-:snip-frontend:development',
    );
  });

  it('uses a generic fallback message for the runtime_debug case without status', () => {
    render(
      <InvestigateDependencyButton
        component="snip-frontend"
        environment="development"
        caseType="runtime_debug"
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(firstCall().initialMessage).toBe(
      "What's wrong with `snip-frontend` in `development`?",
    );
  });

  it('warms the assistant tool cache on hover', () => {
    render(
      <InvestigateDependencyButton
        component="snip-frontend"
        status="Pending"
      />,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(holder.warmup).toHaveBeenCalledTimes(1);
  });

  it('swallows warm-up rejections without throwing', async () => {
    holder.warmup = jest.fn().mockRejectedValue(new Error('boom'));
    render(
      <InvestigateDependencyButton
        component="snip-frontend"
        status="Pending"
      />,
    );
    expect(() =>
      fireEvent.mouseEnter(screen.getByRole('button')),
    ).not.toThrow();
    // Flush the rejected warm-up promise; the .catch() handles it so no
    // unhandled rejection escapes.
    await Promise.resolve();
    expect(holder.warmup).toHaveBeenCalledTimes(1);
  });
});
