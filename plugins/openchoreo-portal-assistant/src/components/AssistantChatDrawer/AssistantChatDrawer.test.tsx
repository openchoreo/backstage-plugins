import { act, fireEvent, render, screen } from '@testing-library/react';
import { AssistantChatDrawer } from './AssistantChatDrawer';
import type { StreamEvent } from '../../api/PerchAgentApi';

// Hoisted spies — see InvestigateLogButton.test.tsx for the rationale.
// Jest hoists jest.mock above imports, so factories cannot close over
// outer variables; they dereference this holder at call time instead.
type StreamRequest = {
  messages: Array<{ role: string; content: string }>;
  scope?: Record<string, unknown>;
};
const holder: {
  streamChat: jest.Mock<
    Promise<void>,
    [StreamRequest, (event: StreamEvent) => void]
  >;
  warmup: jest.Mock<Promise<void>, []>;
  pathname: string;
  onEvent: ((event: StreamEvent) => void) | null;
  resolveStream: (() => void) | null;
  lastRequest: StreamRequest | null;
} = {
  // Reassigned per-test in beforeEach; declared here so the jest.mock
  // factory closures can refer to ``holder.streamChat``.
  streamChat: jest.fn(),
  warmup: jest.fn(),
  pathname: '/catalog/shop/component/svc-a',
  onEvent: null,
  resolveStream: null,
  lastRequest: null,
};

jest.mock('@backstage/core-plugin-api', () => ({
  // PerchAgentApi.ts calls createApiRef at module load — keep a real-ish
  // stub so the import doesn't blow up during test setup.
  createApiRef: (config: { id: string }) => ({ id: config.id }),
  useApi: () => ({
    streamChat: holder.streamChat,
    warmup: holder.warmup,
  }),
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: holder.pathname }),
}));

// react-markdown is ESM and renders nothing useful in jsdom without a
// transform shim — substitute a passthrough so assertions can match the
// raw markdown text rendered into the bubble.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

jest.mock('remark-gfm', () => ({ __esModule: true, default: () => () => {} }));

// remend self-heals partial markdown; for the test we don't care about
// what it does internally — just return input verbatim.
jest.mock('remend', () => ({
  __esModule: true,
  default: (text: string) => text,
}));

function sendMessage(text: string) {
  const composer = screen.getByPlaceholderText(
    /message portal assistant/i,
  ) as HTMLTextAreaElement;
  fireEvent.change(composer, { target: { value: text } });
  // The Send IconButton's aria label is the title "Send (Enter)" — fall
  // back to the keyboard shortcut to keep this resilient.
  fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
}

async function fireStreamEvent(event: StreamEvent) {
  if (!holder.onEvent) {
    throw new Error('streamChat has not been called yet');
  }
  await act(async () => {
    holder.onEvent!(event);
  });
}

async function finishStream() {
  await act(async () => {
    holder.resolveStream?.();
    // Flush microtasks so the trailing setIsSending(false) and any
    // queued state updates land before assertions run.
    await Promise.resolve();
  });
}

beforeEach(() => {
  holder.pathname = '/catalog/shop/component/svc-a';
  holder.onEvent = null;
  holder.resolveStream = null;
  holder.lastRequest = null;
  holder.warmup = jest.fn().mockResolvedValue(undefined);
  holder.streamChat = jest
    .fn<Promise<void>, [StreamRequest, (event: StreamEvent) => void]>()
    .mockImplementation((req, onEvent) => {
      holder.lastRequest = req;
      holder.onEvent = onEvent;
      return new Promise<void>(resolve => {
        holder.resolveStream = resolve;
      });
    });

  // navigator.clipboard isn't defined in jsdom — stub a writeText spy.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

const baseProps = {
  open: true,
  onClose: jest.fn(),
};

describe('AssistantChatDrawer fix-prompt banner', () => {
  it('does not render the banner when the assistant turn has no fix_prompt', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('list things');
    await fireStreamEvent({
      type: 'done',
      message: 'OK here is a list.',
    } as StreamEvent);
    await finishStream();

    // Banner label text from the drawer's banner JSX.
    expect(screen.queryByText(/prompt for ai agents/i)).not.toBeInTheDocument();
    // The text-button "Copy" only ships inside the banner today, so its
    // absence is a second, independent assertion of the same gate.
    expect(
      screen.queryByRole('button', { name: /copy diagnosis as a prompt/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the banner + Copy button when the done event supplies a fix_prompt', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('why did the build fail?');
    await fireStreamEvent({
      type: 'done',
      message: '**What happened**\n\nIt failed.',
      fix_prompt: 'paste me into CodeRabbit',
    } as StreamEvent);
    await finishStream();

    expect(screen.getByText(/prompt for ai agents/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /copy diagnosis as a prompt/i }),
    ).toBeInTheDocument();
  });

  it('writes the backend-supplied prompt verbatim to the clipboard on Copy', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('why did the build fail?');
    const prompt = '```text\nERR foo\n```\nRepo: https://github.com/x/y';
    await fireStreamEvent({
      type: 'done',
      message: 'It failed.',
      fix_prompt: prompt,
    } as StreamEvent);
    await finishStream();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /copy diagnosis as a prompt/i }),
      );
      // Drain the async clipboard write so the Snackbar toast lands.
      await Promise.resolve();
      await Promise.resolve();
    });

    // The drawer never synthesises — what the backend sent is what
    // lands on the clipboard. If this ever drifts, the frontend is
    // re-adding framing the agent's prompt-template already forbids.
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(prompt);
    expect(
      screen.getByText(/copied — paste into your ai coding assistant/i),
    ).toBeInTheDocument();
  });

  it('toggles the inline preview via the expand chevron', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('why?');
    const prompt = 'verbatim error excerpt for AI';
    await fireStreamEvent({
      type: 'done',
      message: 'It failed.',
      fix_prompt: prompt,
    } as StreamEvent);
    await finishStream();

    // Collapsed by default — the prompt text is not in the DOM until
    // the chevron toggles the <pre> open. Use an exact match so we
    // don't accidentally pick up the banner's label text.
    expect(screen.queryByText(prompt)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /show the generated prompt/i }),
    );
    expect(screen.getByText(prompt)).toBeInTheDocument();

    // Same button, now its aria-label flips to "Hide ...".
    fireEvent.click(
      screen.getByRole('button', { name: /hide the generated prompt/i }),
    );
    expect(screen.queryByText(prompt)).not.toBeInTheDocument();
  });

  it('falls back to execCommand, cleans up the textarea, and reports failure when the command returns false', async () => {
    // The execCommand path runs on http-served Backstage installs that
    // can't reach navigator.clipboard. Two things matter for this path:
    //   1. The hidden textarea must be removed even if select()/copy
    //      throw or refuse — otherwise every click leaks an element.
    //   2. execCommand returns boolean. ``false`` (sandbox / focus
    //      rules / etc.) must surface a failure toast, not the
    //      "Copied" success message.
    // Remove the Clipboard API so the fallback branch fires.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    // jsdom doesn't ship document.execCommand as a real property, so
    // jest.spyOn rejects it. Assign a plain mock directly and restore
    // the original (likely ``undefined``) afterwards.
    const execMock = jest.fn().mockReturnValue(false);
    const originalExec = (
      document as Document & { execCommand?: typeof document.execCommand }
    ).execCommand;
    (
      document as Document & { execCommand: typeof document.execCommand }
    ).execCommand = execMock as unknown as typeof document.execCommand;

    try {
      render(<AssistantChatDrawer {...baseProps} />);
      sendMessage('why?');
      await fireStreamEvent({
        type: 'done',
        message: 'It failed.',
        fix_prompt: 'paste me',
      } as StreamEvent);
      await finishStream();

      const beforeTextareas = document.querySelectorAll('textarea').length;

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /copy diagnosis as a prompt/i }),
        );
        await Promise.resolve();
      });

      expect(execMock).toHaveBeenCalledWith('copy');
      // The fallback's off-screen textarea must be cleaned up.
      expect(document.querySelectorAll('textarea').length).toBe(
        beforeTextareas,
      );
      // Failure toast, not the success one.
      expect(
        screen.getByText(/copy failed — please copy manually/i),
      ).toBeInTheDocument();
    } finally {
      (
        document as Document & { execCommand?: typeof document.execCommand }
      ).execCommand = originalExec;
    }
  });

  it('surfaces the tool_call activeForm as the working indicator', async () => {
    // Tool-call events drive the "Thinking … / Looking up workflow …"
    // strip while the agent runs read tools. The activeForm string is
    // taken from the event payload verbatim so prompt tuning shows
    // up immediately in the UI.
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('look it up');
    await fireStreamEvent({
      type: 'tool_call',
      tool: 'get_workflow_run',
      activeForm: 'Looking up workflow run',
    } as StreamEvent);

    expect(screen.getByText(/looking up workflow run/i)).toBeInTheDocument();
  });

  it('renders the error message when the agent emits an error event', async () => {
    // Error events come through the same NDJSON pipe as tool_call /
    // message_chunk and feed setError. The user sees them inline rather
    // than as a toast so the failure is anchored to the conversation.
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('boom');
    await fireStreamEvent({
      type: 'error',
      message: 'rate limit exceeded',
    } as StreamEvent);
    await finishStream();

    expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
  });

  it('shows a "Copy failed" toast when navigator.clipboard.writeText rejects', async () => {
    // Real-world: the Clipboard API can reject under sandbox / focus
    // restrictions. The catch must surface a failure toast rather than
    // silently dropping the click.
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error('permission denied'),
    );

    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('why?');
    await fireStreamEvent({
      type: 'done',
      message: 'It failed.',
      fix_prompt: 'paste me',
    } as StreamEvent);
    await finishStream();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /copy diagnosis as a prompt/i }),
      );
      // Drain the rejected promise so the catch runs before assertions.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText(/copy failed: permission denied/i),
    ).toBeInTheDocument();
  });

  it('does not carry expanded prompts across a Clear-conversation reset', async () => {
    // Regression: expandedPrompts was a Set keyed by timeline index that
    // persisted across resets. After Clear, the next assistant turn at
    // index 0 (or 1) would render pre-expanded if the prior chat had
    // that index in the Set. handleClear must wipe the Set alongside
    // the timeline.
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('first');
    const prompt1 = 'first prompt content';
    await fireStreamEvent({
      type: 'done',
      message: 'first answer.',
      fix_prompt: prompt1,
    } as StreamEvent);
    await finishStream();

    // Expand the first chat's prompt so the Set has a known entry.
    fireEvent.click(
      screen.getByRole('button', { name: /show the generated prompt/i }),
    );
    expect(screen.getByText(prompt1)).toBeInTheDocument();

    // Clear conversation.
    fireEvent.click(
      screen.getByRole('button', { name: /clear conversation/i }),
    );

    // Start a new chat — same indices, different content.
    sendMessage('second');
    const prompt2 = 'second prompt content';
    await fireStreamEvent({
      type: 'done',
      message: 'second answer.',
      fix_prompt: prompt2,
    } as StreamEvent);
    await finishStream();

    // The banner is present (new assistant turn has fix_prompt) but the
    // expander state must NOT have leaked — the preview block is hidden
    // until the user explicitly toggles this turn's chevron.
    expect(
      screen.getByRole('button', { name: /show the generated prompt/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(prompt2)).not.toBeInTheDocument();
  });

  it('drafts initialMessage into the composer when an external trigger advances openSeq', async () => {
    // External triggers (FailedBuildSnackbar / BuildPagePromptLauncher)
    // open the drawer by bumping openSeq and passing a fresh
    // conversationKey plus an initialMessage. The drawer's wipe-and-seed
    // useEffect must run — clearing any prior timeline/expander state
    // and prefilling the composer so the user reviews the agent's first
    // turn before sending. Without this, an external open against a
    // drawer that was already mounted would either ignore the new seed
    // or send it silently.
    const { rerender } = render(<AssistantChatDrawer {...baseProps} />);
    rerender(
      <AssistantChatDrawer
        {...baseProps}
        openSeq={1}
        conversationKey="conv-a"
        initialMessage="Why did this fail?"
      />,
    );

    const composer = screen.getByPlaceholderText(
      /message portal assistant/i,
    ) as HTMLTextAreaElement;
    expect(composer.value).toBe('Why did this fail?');
  });

  it('auto-dismisses the copy toast after the snackbar timeout', async () => {
    // The success toast is intentionally non-persistent — it confirms
    // the click and disappears so the user can keep reading without
    // dismissing it. Snackbar's autoHideDuration drives the onClose
    // closure that wipes copyToast back to null; verify the toast is
    // gone after the configured 2.5s rather than relying on the user
    // to clear it.
    jest.useFakeTimers();
    try {
      render(<AssistantChatDrawer {...baseProps} />);
      sendMessage('why?');
      await fireStreamEvent({
        type: 'done',
        message: 'It failed.',
        fix_prompt: 'paste me',
      } as StreamEvent);
      await finishStream();

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /copy diagnosis as a prompt/i }),
        );
        await Promise.resolve();
      });
      expect(
        screen.getByText(/copied — paste into your AI coding assistant/i),
      ).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(
        screen.queryByText(/copied — paste into your AI coding assistant/i),
      ).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('AssistantChatDrawer scope plumbing', () => {
  it('forwards pin.repoUrl into scope.repoUrl on the streamChat request', async () => {
    // The agent's BUILD-FAILURE prompt expects scope.repo_url to be
    // present so it can include `Repo: <url>` in the generated
    // fix_prompt. The drawer's scope-memo is the wire-side proof that
    // pin.repoUrl actually reaches the backend.
    render(
      <AssistantChatDrawer
        {...baseProps}
        pin={{
          kind: 'workflow_run',
          namespace: 'shop',
          component: 'svc-a',
          runName: 'svc-a-build-1',
          runStatus: 'Failed',
          caseType: 'build_failure',
          repoUrl: 'https://github.com/foo/svc-a',
        }}
      />,
    );
    sendMessage('why did this fail?');

    expect(holder.streamChat).toHaveBeenCalledTimes(1);
    expect(holder.lastRequest?.scope).toMatchObject({
      namespace: 'shop',
      component: 'svc-a',
      runName: 'svc-a-build-1',
      caseType: 'build_failure',
      repoUrl: 'https://github.com/foo/svc-a',
    });
  });
});
