import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AssistantChatDrawer } from './AssistantChatDrawer';
import type { StreamEvent } from '../../api/PortalAssistantApi';
import {
  changeCards,
  existingCheckCards,
  messageCards,
  saveCards,
} from '../AgentUi/changeCards.fixture';

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

// ``mock`` prefix: jest lets the hoisted factory below refer to it.
const mockConfirmChange = jest.fn();
const mockQueryEntities = jest.fn();
// One object for every API, the assistant's and the catalog's, and the same
// instance on every render like the real useApi: the component picker
// searches again whenever its API changes.
const mockApi = {
  streamChat: (...args: Parameters<typeof holder.streamChat>) =>
    holder.streamChat(...args),
  warmup: () => holder.warmup(),
  confirmChange: (...args: unknown[]) => mockConfirmChange(...args),
  queryEntities: (...args: unknown[]) => mockQueryEntities(...args),
  // The picker's entity field also reads the catalog's kinds and config.
  getEntityFacets: async () => ({ facets: { kind: [] } }),
  getOptionalString: () => undefined,
  getOptionalConfig: () => undefined,
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockApi,
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

/**
 * Answers a check authoring chat's first card (how the user wants to work)
 * and finishes the turn its message starts, as if the welcome came.
 */
async function pickLevel(label = 'New to checks') {
  fireEvent.click(screen.getByText(label));
  await fireStreamEvent({ type: 'done', message: 'Welcome!' } as StreamEvent);
  await finishStream();
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
  mockQueryEntities.mockResolvedValue({
    items: [
      {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: { name: 'order-api', namespace: 'default' },
      },
    ],
  });
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

describe('AssistantChatDrawer check_authoring replies', () => {
  // The agent's cards come from code; a reply without one is plain Markdown.
  it('shows a reply without a card as Markdown, with no copy buttons', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    sendMessage('repos must not be archived');
    await fireStreamEvent({
      type: 'done',
      message: [
        'Name: Repo not archived',
        '',
        '```json',
        '{"all":[{"fact":"githubIsArchived","operator":"equal","value":false}]}',
        '```',
      ].join('\n'),
    } as StreamEvent);
    await finishStream();

    expect(screen.getByText(/Repo not archived/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Copy / })).toBeNull();
  });
});

describe('AssistantChatDrawer confirm card', () => {
  // Past the test step (see "test first"), so it offers the save buttons.
  const card = {
    type: 'confirmation_required',
    test_skipped: true,
    token: 'signed-token',
    kind: 'update',
    check_id: 'c1',
    check_name: 'Default branch protection',
    status: 'draft',
    current_rule: '{}',
    new_rule: '{ "all": [] }',
    text_changes: [],
    valid: true,
    problems: [],
  } as StreamEvent;

  it('tells the page that opened it after a card saves a check', async () => {
    mockConfirmChange.mockResolvedValue({
      check_id: 'c1',
      status: 'draft',
      message: 'Saved as a draft.',
    });
    const onChecksChanged = jest.fn();
    render(
      <AssistantChatDrawer {...baseProps} onChecksChanged={onChecksChanged} />,
    );
    sendMessage('yes');
    await fireStreamEvent(card);
    await fireStreamEvent({
      type: 'done',
      message: 'Edited rule: …',
    } as StreamEvent);
    await finishStream();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    });

    expect(onChecksChanged).toHaveBeenCalledTimes(1);
  });

  it('shows the card under the reply it came with', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('yes');
    await fireStreamEvent(card);
    await fireStreamEvent({
      type: 'done',
      message: 'Edited rule: …',
    } as StreamEvent);
    await finishStream();

    expect(
      screen.getByRole('group', {
        name: 'Save check Default branch protection',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save and publish' }),
    ).toBeInTheDocument();
  });

  it('shows no card on a reply without one', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('hello');
    await fireStreamEvent({ type: 'done', message: 'Hi!' } as StreamEvent);
    await finishStream();

    expect(
      screen.queryByRole('group', { name: /^(Save|Create) check/ }),
    ).toBeNull();
  });
});

describe('AssistantChatDrawer after a save', () => {
  const rule = JSON.stringify({
    all: [{ fact: 'githubIsArchived', operator: 'equal', value: false }],
  });
  // ``ready``: past the test step, so the card offers the save buttons.
  const draft = (token: string, ready = true) =>
    ({
      type: 'confirmation_required',
      ...(ready ? { test_skipped: true } : {}),
      token,
      kind: 'create',
      check_name: 'Repo not archived',
      description: 'Fails if the repository is archived',
      fact_ids: ['githubRepositoryFactRetriever'],
      applies_to: ['component'],
      new_rule: rule,
      valid: true,
      problems: [],
    } as StreamEvent);

  async function draftTurn(text: string, token: string, ready = true) {
    sendMessage(text);
    await fireStreamEvent(draft(token, ready));
    await fireStreamEvent({
      type: 'done',
      message: 'Name: Repo not archived',
    } as StreamEvent);
    await finishStream();
  }

  async function pickAndTest(within_: HTMLElement) {
    await act(async () => {
      fireEvent.mouseDown(
        within(within_).getByRole('textbox', { name: 'Entity to test on' }),
      );
    });
    const option = await screen.findByRole('option', { name: /order-api/ });
    await act(async () => {
      fireEvent.click(option);
    });
    await act(async () => {
      fireEvent.click(within(within_).getByRole('button', { name: 'Test' }));
    });
  }

  beforeEach(() => {
    mockConfirmChange.mockResolvedValue({
      check_id: 'new-1',
      status: 'draft',
      message: 'Saved as a draft.',
    });
  });

  it('confirms the save without offering a test, and carries on with the saved check', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await pickLevel();
    await draftTurn('Repos must not be archived', 't1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    });

    const next = screen.getByRole('group', { name: 'Saved as a draft' });
    expect(within(next).getByText('Repo not archived')).toBeInTheDocument();
    expect(
      within(next).getByText(/doesn't change any scores until you publish/),
    ).toBeInTheDocument();
    // A test is offered before saving, not after.
    expect(
      screen.queryByRole('textbox', { name: 'Entity to test on' }),
    ).toBeNull();
    expect(screen.queryByText(/try it on a component/i)).toBeNull();
    // Saving offers nothing more: what to do next is for the example only.
    expect(
      screen.queryByRole('button', {
        name: 'Show me the different areas I can write checks for',
      }),
    ).toBeNull();
    // The level picker stays at the top, as the chat opened with it.
    expect(
      screen.getByRole('group', { name: 'Write a new check' }),
    ).toBeInTheDocument();

    // The user can still ask for one.
    sendMessage('Test it on component:default/order-api');

    // The follow-up is never sent to the agent.
    expect(holder.lastRequest?.messages).toEqual([
      {
        role: 'user',
        content: "I'm new to checks. Walk me through it, with examples.",
        action: { name: 'pick_level', context: { level: 'beginner' } },
      },
      { role: 'assistant', content: 'Welcome!' },
      { role: 'user', content: 'Repos must not be archived' },
      { role: 'assistant', content: 'Name: Repo not archived' },
      { role: 'user', content: 'Test it on component:default/order-api' },
    ]);
    // The chat is now about the saved check, so the agent only tests it.
    expect(holder.lastRequest?.scope).toMatchObject({
      caseType: 'check_authoring',
      checkId: 'new-1',
      checkName: 'Repo not archived',
      checkDescription: 'Fails if the repository is archived',
      currentRule: rule,
      selectedFactIds: ['githubRepositoryFactRetriever'],
    });
  });

  it('offers what to do next, not saving, once the example is tested', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await pickLevel('New to checks');
    const example = 'Try an example: the default branch must be protected';
    sendMessage(example);
    await fireStreamEvent({
      ...draft('t1', false),
      example: true,
    } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: 'Name: Repo not archived',
    } as StreamEvent);
    await finishStream();

    // First the test, and why.
    expect(
      screen.getByText(
        /This is what a check looks like\. Pick one of your components/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/come after the test/)).toBeNull();

    sendMessage('Test it on component:default/order-api');
    await fireStreamEvent({
      ...draft('t2'),
      example: true,
      tested: true,
    } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: 'It passes on order-api.',
    } as StreamEvent);
    await finishStream();

    // Practice: no saving, but what to do next.
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull();
    expect(
      screen.getByText(/what else you can check, or do you have your own rule/),
    ).toBeInTheDocument();
    // The same button and hint as the new check intro's (2026-11-25); the
    // intro's own one is read-only by now.
    const own = screen
      .getAllByRole('button', { name: 'Describe your own check' })
      .find(button => !(button as HTMLButtonElement).disabled)!;
    expect(
      screen.queryByRole('button', { name: 'Tell me something else' }),
    ).toBeNull();
    fireEvent.click(own);
    expect(
      screen.getByPlaceholderText(
        'Describe the check you need, for example: repos must be private',
      ),
    ).toHaveFocus();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Show me the different areas I can write checks for',
      }),
    );

    // The familiar user's welcome, for a new check.
    expect(holder.lastRequest?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Show me the different areas I can write checks for',
      action: { name: 'show_facts' },
    });
    expect(holder.lastRequest?.scope).toMatchObject({
      experience: 'experienced',
      welcome: true,
    });
    expect(
      screen.getByRole('button', {
        name: 'Show me the different areas I can write checks for',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    // The intro card stays at the top, read-only.
    expect(
      within(
        screen.getByRole('group', { name: 'Write a new check' }),
      ).getByRole('button', { name: /^New to checks/ }),
    ).toBeDisabled();
  });

  it('tests a draft from its save card before it is saved', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await draftTurn('Repos must not be archived', 't1', false);

    await pickAndTest(
      screen.getByRole('group', { name: 'Create check Repo not archived' }),
    );

    expect(holder.lastRequest?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Test it on component:default/order-api',
      action: {
        name: 'test',
        context: { entityRef: 'component:default/order-api' },
      },
    });
    // Not saved: still a new check.
    expect(holder.lastRequest?.scope?.checkId).toBeUndefined();
  });

  it('turns an unsaved card off when a newer one arrives', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await draftTurn('Repos must not be archived', 't1');
    await draftTurn('Test it on component:default/order-api', 't2');

    expect(
      screen.getAllByText('A newer version of this check is below.'),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Save as draft' }),
    ).toHaveLength(1);
  });

  it('offers only to save once the draft was tested', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await draftTurn('Repos must not be archived', 't1', false);
    expect(screen.getByText(/Test it on a component/)).toBeInTheDocument();

    sendMessage('Test it on component:default/order-api');
    await fireStreamEvent({ ...draft('t2'), tested: true } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: 'It fails on order-api.',
    } as StreamEvent);
    await finishStream();

    // The tested card offers to save only; the earlier one is off.
    expect(screen.queryByText(/Test it on a component/)).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'Save as draft' }),
    ).toHaveLength(1);
    expect(
      screen.getByText('A newer version of this check is below.'),
    ).toBeInTheDocument();
  });

  it('starts over as a new check after Clear', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await draftTurn('Repos must not be archived', 't1');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    sendMessage('Another check');

    expect(holder.lastRequest?.scope?.checkId).toBeUndefined();
    expect(
      screen.queryByRole('group', { name: 'Saved as a draft' }),
    ).not.toBeInTheDocument();
  });

  it('shows no follow-up when the save fails', async () => {
    mockConfirmChange.mockRejectedValue(new Error('Not allowed'));
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await draftTurn('Repos must not be archived', 't1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Not allowed');
    expect(
      screen.queryByRole('group', { name: 'Saved as a draft' }),
    ).not.toBeInTheDocument();
  });
});

describe('AssistantChatDrawer answer buttons', () => {
  // What the agent sends with a check edit question (src/agent/a2ui.py).
  const buttons = {
    type: 'a2ui',
    messages: [
      {
        version: '1.0',
        createSurface: {
          surfaceId: 'edit-question-1',
          catalogId: 'openchoreo.dev:portal-assistant/v1',
          components: [
            { id: 'root', component: 'Row', children: ['yes', 'no'] },
            {
              id: 'yes',
              component: 'Button',
              child: 'yes_label',
              variant: 'primary',
              action: { event: { name: 'confirm_edit', userMessage: 'yes' } },
            },
            { id: 'yes_label', component: 'Text', text: 'Yes, change it' },
            {
              id: 'no',
              component: 'Button',
              child: 'no_label',
              action: { event: { name: 'reject_edit', userMessage: 'no' } },
            },
            { id: 'no_label', component: 'Text', text: 'No' },
          ],
        },
      },
    ],
  } as StreamEvent;

  async function question() {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('make it 3');
    await fireStreamEvent(buttons);
    await fireStreamEvent({
      type: 'done',
      message: 'Shall I change it to that?',
    } as StreamEvent);
    await finishStream();
  }

  it('shows the buttons under the question', async () => {
    await question();

    expect(
      await screen.findByRole('button', { name: 'Yes, change it' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'No' })).toBeEnabled();
  });

  it('sends "yes" as the next message when Yes is clicked', async () => {
    await question();

    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Yes, change it' }),
      );
    });

    expect(holder.streamChat).toHaveBeenCalledTimes(2);
    expect(holder.lastRequest?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'yes',
      action: { name: 'confirm_edit' },
    });
  });

  it('can not answer the same question twice', async () => {
    await question();
    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Yes, change it' }),
      );
    });

    // A newer message follows the question, so its buttons are done.
    expect(
      screen.getByRole('button', { name: 'Yes, change it' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
  });
});

describe('AssistantChatDrawer message card', () => {
  it('shows any other check authoring reply once, inside the card', async () => {
    const reply = messageCards.answer.createSurface.components[0]
      .text as string;
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('what does this check do?');
    await fireStreamEvent({
      type: 'a2ui',
      messages: [messageCards.answer],
    } as StreamEvent);
    await fireStreamEvent({ type: 'done', message: reply } as StreamEvent);
    await finishStream();

    const card = await screen.findByRole('group', { name: 'Reply' });
    const shown = screen.getAllByText(/This check passes when/);
    expect(shown).toHaveLength(1);
    expect(shown[0].closest('[role="group"]')).toBe(card);
  });
});

describe('AssistantChatDrawer change card', () => {
  it('shows the card in place of the reply text', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('make it 3');
    await fireStreamEvent({
      type: 'a2ui',
      messages: [changeCards.one],
    } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: [
        '**Current rule:** `githubRequiredApprovingReviewCount` `greaterThanInclusive` `2` — 2 or more',
        '',
        '**What I understood:** You want to raise the required approving reviews from 2 to 3.',
        '',
        '**Proposed rule:** `githubRequiredApprovingReviewCount` `greaterThanInclusive` `3` — 3 or more',
        '',
        'Shall I change it to that?',
      ].join('\n'),
    } as StreamEvent);
    await finishStream();

    const card = await screen.findByRole('group', { name: 'Proposed change' });
    // The sentence shows once, inside the card.
    expect(
      screen
        .getByText(
          'You want to raise the required approving reviews from 2 to 3.',
        )
        .closest('[role="group"]'),
    ).toBe(card);
    expect(screen.queryByText(/greaterThanInclusive/)).toBeNull();
    expect(screen.queryByText(/Shall I change it/)).toBeNull();
  });

  it('sends the full reply, not just the card, back to the agent', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('make it 3');
    await fireStreamEvent({
      type: 'a2ui',
      messages: [changeCards.one],
    } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: '**Proposed rule:** `a` `equal` `true`',
    } as StreamEvent);
    await finishStream();

    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Yes, change it' }),
      );
    });

    expect(holder.lastRequest?.messages.slice(-2)).toEqual([
      { role: 'assistant', content: '**Proposed rule:** `a` `equal` `true`' },
      { role: 'user', content: 'yes', action: { name: 'confirm_edit' } },
    ]);
  });
});

describe('AssistantChatDrawer save card', () => {
  it('shows the A2UI save card once, in place of the confirm card, and saves with it', async () => {
    mockConfirmChange.mockResolvedValue({
      check_id: 'c1',
      status: 'published',
      message: 'Saved and kept published.',
    });
    const onChecksChanged = jest.fn();
    render(
      <AssistantChatDrawer {...baseProps} onChecksChanged={onChecksChanged} />,
    );
    sendMessage('yes');
    // Past the test step, so it offers the save buttons.
    const surface = JSON.parse(JSON.stringify(saveCards.edit));
    const card = surface.createSurface.components[0].card as Record<
      string,
      unknown
    >;
    card.test_skipped = true;
    await fireStreamEvent({
      type: 'confirmation_required',
      ...card,
    } as StreamEvent);
    await fireStreamEvent({
      type: 'a2ui',
      messages: [surface],
    } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: 'Edited rule: …',
    } as StreamEvent);
    await finishStream();

    const groups = await screen.findAllByRole('group', { name: /^Save check/ });
    expect(groups).toHaveLength(1);
    expect(screen.getByText('Change')).toBeInTheDocument();
    // The card shows the change: the reply's text isn't repeated above it.
    expect(screen.queryByText('Edited rule: …')).toBeNull();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Save and keep published' }),
      );
    });

    expect(mockConfirmChange).toHaveBeenCalledWith(
      'signed-token',
      'published',
      true,
    );
    expect(onChecksChanged).toHaveBeenCalledTimes(1);
  });
});

describe('AssistantChatDrawer live progress', () => {
  const progressCard = () =>
    screen.queryByRole('status', { name: 'Working on it' });

  it('shows the step a check authoring turn is on now, on one line', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    sendMessage('repos must be private');
    await fireStreamEvent({
      type: 'tool_call',
      tool: 'validate_check',
      activeForm: 'Checking the rule',
    });

    // 2026-11-25: one line that changes in place the moment a step comes,
    // with no list or ticks, and no "Thinking..." line under it.
    const card = progressCard()!;
    expect(within(card).getByText('Checking the rule')).toBeInTheDocument();
    expect(within(card).queryByRole('listitem')).toBeNull();
    expect(screen.queryByText('Thinking')).toBeNull();

    for (const [tool, activeForm] of [
      ['think', 'Thinking'],
      ['write_reply', 'Writing the reply'],
    ]) {
      await fireStreamEvent({ type: 'tool_call', tool, activeForm });
    }

    expect(within(card).getByText('Writing the reply')).toBeInTheDocument();
    expect(within(card).queryByText('Checking the rule')).toBeNull();
  });

  it('shows a dry-run result as soon as it comes back', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    sendMessage('test it on order-api');
    await fireStreamEvent({
      type: 'dry_run_result',
      status: 'failed',
      title: 'order-api',
      summary: "order-api doesn't meet this rule.",
      sections: [],
    });

    expect(
      within(progressCard()!).getByText('Test on order-api'),
    ).toBeInTheDocument();
  });

  it('takes the card away when the reply arrives', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    sendMessage('repos must be private');
    expect(progressCard()).toBeInTheDocument();

    await fireStreamEvent({ type: 'done', message: 'Here is the check.' });
    await finishStream();

    expect(progressCard()).toBeNull();
  });

  it('keeps the Thinking line for other chats', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('why did the build fail?');

    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(progressCard()).toBeNull();
  });
});

describe('AssistantChatDrawer hand-off from the live progress card', () => {
  const allowMotion = (allowed: boolean) =>
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: allowed && query.includes('no-preference'),
      }),
    });

  const startTurn = async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    sendMessage('repos must be private');
    await fireStreamEvent({
      type: 'tool_call',
      tool: 'validate_check',
      activeForm: 'Checking the rule',
    });
  };

  const wait = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it('shows every step done, then lets the reply take the card’s place', async () => {
    allowMotion(true);
    await startTurn();

    await fireStreamEvent({ type: 'done', message: 'Here is the check.' });
    const card = screen.getByRole('status', { name: 'Ready' });
    expect(within(card).queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('Here is the check.')).toBeNull();

    await wait(300);
    expect(screen.getByText('Here is the check.')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Ready' })).toBeInTheDocument();

    await wait(280);
    await finishStream();
    expect(screen.queryByRole('status', { name: 'Ready' })).toBeNull();
    expect(screen.getByText('Here is the check.')).toBeInTheDocument();
  });

  it('keeps the composer off until the reply has taken the card’s place', async () => {
    allowMotion(true);
    await startTurn();

    await fireStreamEvent({ type: 'done', message: 'Here is the check.' });
    await finishStream();
    expect(
      screen.getByPlaceholderText(/message portal assistant/i),
    ).toBeDisabled();

    await wait(300);
    expect(
      screen.getByPlaceholderText(/message portal assistant/i),
    ).toBeDisabled();
    await wait(280);
    expect(
      screen.getByPlaceholderText(/message portal assistant/i),
    ).toBeEnabled();
  });

  it('swaps at once when the browser asks for less motion', async () => {
    allowMotion(false);
    await startTurn();

    await fireStreamEvent({ type: 'done', message: 'Here is the check.' });

    expect(screen.getByText('Here is the check.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Ready' })).toBeNull();
  });

  it('takes the card away at once on an error', async () => {
    allowMotion(true);
    await startTurn();

    await fireStreamEvent({ type: 'error', message: 'The agent failed.' });

    expect(screen.getByText('The agent failed.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Working on it' })).toBeNull();
  });
});

describe('AssistantChatDrawer save card, test first', () => {
  it('offers only the test first, and the save buttons with the next card', async () => {
    render(<AssistantChatDrawer {...baseProps} />);
    sendMessage('yes');
    const { createSurface } = saveCards.edit;
    const card = createSurface.components[0].card as Record<string, unknown>;
    await fireStreamEvent({
      type: 'confirmation_required',
      ...card,
    } as StreamEvent);
    await fireStreamEvent({
      type: 'a2ui',
      messages: [saveCards.edit],
    } as StreamEvent);
    await fireStreamEvent({
      type: 'done',
      message: 'Edited rule: …',
    } as StreamEvent);
    await finishStream();

    expect(
      screen.getByText(
        'Test it on a component first, to see whether it passes.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save and keep published' }),
    ).toBeNull();
    expect(
      screen.getByText(
        'Save as draft and Save and publish come after the test.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip the test' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('AssistantChatDrawer check authoring level and welcome', () => {
  const welcomeSurface = {
    version: '1.0',
    createSurface: {
      surfaceId: 'reply-welcome',
      catalogId: 'openchoreo.dev:portal-assistant/v1',
      components: [
        {
          id: 'root',
          component: 'ReplyCard',
          title: 'Let’s write your first check',
          summary: 'A check is a rule every component is tested against.',
          sections: [],
          choices: ['choice_0', 'choice_1'],
          answer: [],
        },
        ...[
          'Help me understand security checks',
          'Guide me through creating my first check',
        ].map((text, i) => ({
          id: `choice_${i}`,
          component: 'PickRow',
          label: text,
          text,
          action: { event: { name: 'pick_choice', userMessage: text } },
        })),
      ],
    },
  };

  it('opens at once with the fixed opening and the levels, asking the agent nothing', () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );

    // 2026-11-25: a card like the agent's, with its title, the opening's
    // words and the question in blue.
    const picker = screen.getByRole('group', {
      name: 'Write a new check',
    });
    expect(
      within(picker).getByText(
        "Checks help every team follow your security standards. Tell me what you'd like to make sure of, and I'll write the check and test it with you.",
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(
      within(picker).getByText('How would you like to start?').tagName,
    ).toBe('SPAN');
    // The options keep their own words: each sends exactly what it says.
    expect(
      within(picker).getByText('Walk me through it, with examples'),
    ).toBeInTheDocument();
    // One level, and the user's own check instead (2026-11-25: no "I'm
    // familiar with checks").
    expect(
      within(picker)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual([
      'New to checksWalk me through it, with examples',
      'Describe your own check',
    ]);
    // No greeting card, no "getting ready" card, no general chips.
    expect(screen.queryByText('Hi there!')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('List my components')).toBeNull();
    expect(holder.streamChat).not.toHaveBeenCalled();
  });

  it('keeps the intro card, read-only, and sends the level’s message for its welcome', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    const picker = screen.getByRole('group', {
      name: 'Write a new check',
    });

    fireEvent.click(within(picker).getByText('New to checks'));

    expect(holder.lastRequest?.messages).toEqual([
      {
        role: 'user',
        content: "I'm new to checks. Walk me through it, with examples.",
        action: { name: 'pick_level', context: { level: 'beginner' } },
      },
    ]);
    expect(holder.lastRequest?.scope).toMatchObject({
      caseType: 'check_authoring',
      experience: 'beginner',
      welcome: true,
    });
    // The card stays, read-only, like the agent's cards once the chat moves
    // on (no tick).
    const kept = screen.getByRole('group', {
      name: 'Write a new check',
    });
    const beginner = within(kept).getByRole('button', {
      name: /New to checks/,
    });
    expect(beginner).toBeDisabled();
    expect(
      within(kept).getByRole('button', { name: 'Describe your own check' }),
    ).toBeDisabled();
    // Only the level's message went to the agent.
    expect(holder.streamChat).toHaveBeenCalledTimes(1);

    // The agent's welcome is the reply, with its starting questions.
    await fireStreamEvent({
      type: 'a2ui',
      messages: [welcomeSurface],
    } as StreamEvent);
    await fireStreamEvent({ type: 'done', message: 'Welcome!' } as StreamEvent);
    await finishStream();
    const welcome = screen.getByRole('group', {
      name: 'Let’s write your first check',
    });
    // A click sends the suggestion at once.
    await act(async () => {
      fireEvent.click(
        within(welcome).getByRole('button', {
          name: 'Guide me through creating my first check',
        }),
      );
    });

    expect(holder.lastRequest?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Guide me through creating my first check',
      action: { name: 'pick_choice' },
    });
    // The level stays; the welcome was for the first turn only.
    expect(holder.lastRequest?.scope).toMatchObject({ experience: 'beginner' });
    expect(holder.lastRequest?.scope).not.toHaveProperty('welcome');
    expect(screen.queryByRole('button', { name: /^Experience:/ })).toBeNull();
  });

  it('opens an edit chat with the check’s intro, not the level picker', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{
          caseType: 'check_authoring',
          checkId: 'abc-123',
          checkName: 'Require reviews',
          currentRule: JSON.stringify({
            all: [
              {
                fact: 'githubRequiredApprovingReviewCount',
                operator: 'greaterThanInclusive',
                value: 2,
              },
            ],
          }),
        }}
      />,
    );

    const intro = screen.getByRole('group', { name: 'Edit this check' });
    expect(within(intro).getByText('Current rule')).toBeInTheDocument();
    expect(within(intro).getByText('2 or more')).toBeInTheDocument();
    expect(
      within(intro).getByRole('button', { name: 'Explain this rule' }),
    ).toBeEnabled();
    // 2026-11-25: no "How can I improve this?", and the pencil button
    // asks for the change.
    expect(
      within(intro).queryByRole('button', { name: 'How can I improve this?' }),
    ).toBeNull();
    expect(
      within(intro).getByRole('button', { name: 'Describe your change' }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('group', { name: 'Write a new check' }),
    ).toBeNull();

    await act(async () => {
      fireEvent.click(
        within(intro).getByRole('button', { name: 'Explain this rule' }),
      );
    });

    expect(holder.lastRequest?.messages).toEqual([
      {
        role: 'user',
        content: 'Explain this rule',
        action: { name: 'explain_rule' },
      },
    ]);
    expect(holder.lastRequest?.scope).toMatchObject({ checkId: 'abc-123' });
    expect(holder.lastRequest?.scope).not.toHaveProperty('welcome');
  });

  it('offers Describe your own check under the level, pointing to the message box', async () => {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    const picker = screen.getByRole('group', {
      name: 'Write a new check',
    });

    fireEvent.click(
      within(picker).getByRole('button', { name: 'Describe your own check' }),
    );

    const box = screen.getByPlaceholderText(
      'Describe the check you need, for example: repos must be private',
    );
    expect(box).toHaveFocus();
    fireEvent.change(box, { target: { value: 'Repos must be private' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });
    });

    expect(holder.lastRequest?.messages).toEqual([
      { role: 'user', content: 'Repos must be private' },
    ]);
    expect(holder.lastRequest?.scope).not.toHaveProperty('experience');
    // The picker stays, read-only: the chat moved on without a level.
    const kept = screen.getByRole('group', {
      name: 'Write a new check',
    });
    expect(
      within(kept).getByRole('button', { name: /^New to checks/ }),
    ).toBeDisabled();
    expect(
      within(kept).getByRole('button', { name: 'Describe your own check' }),
    ).toBeDisabled();
  });

  it('asks again in a new chat opened while the drawer is open', async () => {
    const { rerender } = render(
      <AssistantChatDrawer
        {...baseProps}
        openSeq={1}
        conversationKey="check-a"
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await pickLevel();

    rerender(
      <AssistantChatDrawer
        {...baseProps}
        openSeq={2}
        conversationKey="check-b"
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Write a new check' }),
      ).getByRole('button', { name: 'Describe your own check' }),
    );
    const box = screen.getByPlaceholderText(
      'Describe the check you need, for example: repos must be private',
    );
    fireEvent.change(box, { target: { value: 'Repos must be private' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });
    });

    expect(holder.lastRequest?.scope).not.toHaveProperty('experience');
  });

  it('asks again after Clear, and when opened again for a new chat', async () => {
    const { rerender } = render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await pickLevel();

    fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(
      within(
        screen.getByRole('group', { name: 'Write a new check' }),
      ).getByRole('button', { name: /^New to checks/ }),
    ).toBeEnabled();

    rerender(
      <AssistantChatDrawer
        {...baseProps}
        open={false}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    rerender(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    expect(
      within(
        screen.getByRole('group', { name: 'Write a new check' }),
      ).getByRole('button', { name: /^New to checks/ }),
    ).toBeEnabled();
  });

  it('leaves other chats alone', async () => {
    render(<AssistantChatDrawer {...baseProps} />);

    expect(
      screen.queryByRole('group', { name: 'Write a new check' }),
    ).toBeNull();
    expect(screen.getByText('List my components')).toBeInTheDocument();
    sendMessage('Why did my build fail?');
    await waitFor(() => expect(holder.streamChat).toHaveBeenCalled());
    expect(holder.lastRequest?.scope).not.toHaveProperty('experience');
  });
});

describe('AssistantChatDrawer a saved check like the draft', () => {
  const DRAFT = 'Name: Protected branch with 2 reviews';

  // A new check's draft, answered with the card of a saved check like it.
  async function foundTurn(card: unknown) {
    render(
      <AssistantChatDrawer
        {...baseProps}
        scopeOverrides={{ caseType: 'check_authoring' }}
      />,
    );
    await pickLevel();
    sendMessage('Protected branch with 2 reviews');
    await fireStreamEvent({ type: 'a2ui', messages: [card] } as StreamEvent);
    await fireStreamEvent({ type: 'done', message: DRAFT } as StreamEvent);
    await finishStream();
  }

  it('shows the card instead of the draft, with no save card', async () => {
    await foundTurn(existingCheckCards.same);

    expect(
      screen.getByRole('group', { name: 'This check already exists' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(DRAFT)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull();
  });

  it('moves the chat to the same check and shows its intro, sending nothing', async () => {
    await foundTurn(existingCheckCards.same);
    const calls = holder.streamChat.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Edit this check' }));

    const intro = await screen.findByRole('group', { name: 'Edit this check' });
    expect(within(intro).getByText('Branch protection')).toBeInTheDocument();
    expect(within(intro).getByText('2 or more')).toBeInTheDocument();
    expect(holder.streamChat).toHaveBeenCalledTimes(calls);
    // The found card can't be answered any more.
    expect(
      screen.getByRole('button', { name: 'Create a separate check' }),
    ).toBeDisabled();

    fireEvent.click(within(intro).getByText('Explain this rule'));

    await waitFor(() =>
      expect(holder.streamChat).toHaveBeenCalledTimes(calls + 1),
    );
    // The intro is the drawer's own: never sent to the agent.
    expect(holder.lastRequest?.messages.slice(-2)).toEqual([
      { role: 'assistant', content: DRAFT },
      {
        role: 'user',
        content: 'Explain this rule',
        action: { name: 'explain_rule' },
      },
    ]);
    expect(holder.lastRequest?.scope).toMatchObject({
      caseType: 'check_authoring',
      checkId: 'c1',
      checkName: 'Branch protection',
      checkDescription: "Fails if the default branch isn't protected.",
      selectedFactIds: ['githubRepositoryFactRetriever'],
    });
  });

  it("moves the chat to a similar check and asks for the user's rule", async () => {
    await foundTurn(existingCheckCards.similar);

    fireEvent.click(
      screen.getByRole('button', { name: 'Change it to my rule' }),
    );

    await waitFor(() =>
      expect(holder.lastRequest?.messages.at(-1)).toEqual({
        role: 'user',
        content:
          'Change this check to my new rule (Default branch protected: Yes, Approving reviews required: 2 or more)',
      }),
    );
    expect(holder.lastRequest?.scope).toMatchObject({
      checkId: 'c1',
      currentRule: expect.stringContaining('"value":1'),
    });
    await fireStreamEvent({
      type: 'done',
      message: 'Proposed …',
    } as StreamEvent);
    await finishStream();

    // Later turns are about that check too.
    sendMessage('yes');
    expect(holder.lastRequest?.scope).toMatchObject({ checkId: 'c1' });
  });

  it("asks for a separate check in the new check's scope", async () => {
    await foundTurn(existingCheckCards.same);

    fireEvent.click(
      screen.getByRole('button', { name: 'Create a separate check' }),
    );

    await waitFor(() =>
      expect(holder.lastRequest?.messages.at(-1)).toEqual({
        role: 'user',
        content: 'Create a separate check instead of editing Branch protection',
        action: {
          name: 'create_separate',
          context: { check: 'Branch protection' },
        },
      }),
    );
    expect(holder.lastRequest?.scope).not.toHaveProperty('checkId');
  });
});
