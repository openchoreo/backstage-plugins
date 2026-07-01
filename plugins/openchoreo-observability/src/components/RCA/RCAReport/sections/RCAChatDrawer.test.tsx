import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RCAChatDrawer } from './RCAChatDrawer';
import type { RCAAgentApi, StreamEvent } from '../../../../api/RCAAgentApi';

// FormattedText pulls in EntityLinkContext; stub it to plain text so the
// drawer renders without a provider (mirrors CostAnalysisReportView.test).
jest.mock('../FormattedText', () => ({
  FormattedText: ({ text }: any) => <span>{text}</span>,
}));

// Narrow helper so test events don't have to satisfy the full generated
// StreamEvent union — the drawer only reads type/content/activeForm/message.
const ev = (o: Record<string, unknown>): StreamEvent =>
  o as unknown as StreamEvent;

const makeApi = (
  stream: RCAAgentApi['streamRCAChat'],
): jest.Mocked<RCAAgentApi> => ({
  streamRCAChat: jest.fn(stream),
  updateActionStatuses: jest.fn(),
});

const chatContext = (api: RCAAgentApi) => ({
  namespaceName: 'ns',
  environmentName: 'env',
  projectName: 'proj',
  rcaAgentApi: api,
});

const openDrawer = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    screen.getByRole('button', { name: /ask portal assistant/i }),
  );
};

describe('RCAChatDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('shows the FAB and opens the drawer with an empty state', async () => {
    const user = userEvent.setup();
    const api = makeApi(async () => {});
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);

    // Drawer content is not mounted until the FAB is clicked.
    expect(
      screen.queryByPlaceholderText('Message Portal Assistant'),
    ).not.toBeInTheDocument();

    await openDrawer(user);

    expect(screen.getByText(/ask follow-up questions/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Message Portal Assistant'),
    ).toBeInTheDocument();
  });

  it('sends a suggestion chip as a turn to the agent', async () => {
    // The empty-state chips are what make the RCA chat feel like the
    // Portal Assistant — clicking one must actually fire the turn (with
    // the chip wording as the user message), not just prefill the box.
    const user = userEvent.setup();
    const api = makeApi(async (_req, _routing, onEvent) => {
      onEvent(ev({ type: 'done', message: 'chip reply' }));
    });
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.click(
      screen.getByRole('button', { name: /explain the root cause/i }),
    );

    expect(screen.getByText('Explain the root cause')).toBeInTheDocument();
    expect(await screen.findByText('chip reply')).toBeInTheDocument();
    expect(api.streamRCAChat).toHaveBeenCalledTimes(1);
    const [request] = api.streamRCAChat.mock.calls[0];
    expect(request.messages[request.messages.length - 1].content).toContain(
      'Explain the root cause',
    );
  });

  it('hides the launcher FAB while the drawer is open', async () => {
    const user = userEvent.setup();
    const api = makeApi(async () => {});
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);

    // FAB is the only way in while closed; once open it must not overlap
    // the drawer (its z-index sits above the modal layer).
    expect(
      screen.getByRole('button', { name: /ask portal assistant/i }),
    ).toBeInTheDocument();

    await openDrawer(user);

    expect(
      screen.queryByRole('button', { name: /ask portal assistant/i }),
    ).not.toBeInTheDocument();
  });

  it('streams a reply (Enter to send) and forwards the report scope', async () => {
    const user = userEvent.setup();
    const api = makeApi(async (_req, _routing, onEvent) => {
      onEvent(ev({ type: 'tool_call', activeForm: 'Digging deeper...' }));
      onEvent(ev({ type: 'message_chunk', content: 'Hello ' }));
      onEvent(ev({ type: 'message_chunk', content: 'world' }));
      onEvent(ev({ type: 'actions', actions: [] }));
      onEvent(ev({ type: 'mystery_event' })); // unrecognized → ignored
      onEvent(ev({ type: 'done', message: 'Hello world' }));
    });
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText('Message Portal Assistant'),
      'why did it fail?{Enter}',
    );

    // User turn + finalized assistant turn both rendered.
    expect(screen.getByText('why did it fail?')).toBeInTheDocument();
    expect(await screen.findByText('Hello world')).toBeInTheDocument();

    // Report-scoped request + routing context forwarded to the agent.
    expect(api.streamRCAChat).toHaveBeenCalledTimes(1);
    const [request, routing] = api.streamRCAChat.mock.calls[0];
    expect(request).toMatchObject({
      reportId: 'rep-1',
      namespace: 'ns',
      project: 'proj',
      environment: 'env',
    });
    expect(routing).toEqual({ namespaceName: 'ns', environmentName: 'env' });
  });

  it('persists the conversation and clears it on demand', async () => {
    const user = userEvent.setup();
    const api = makeApi(async (_req, _routing, onEvent) => {
      onEvent(ev({ type: 'done', message: 'persisted reply' }));
    });
    render(<RCAChatDrawer reportId="rep-7" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText('Message Portal Assistant'),
      'hi',
    );
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('persisted reply')).toBeInTheDocument();
    expect(localStorage.getItem('rca-chat:rep-7')).toContain('persisted reply');

    await user.click(
      screen.getByRole('button', { name: /clear conversation/i }),
    );

    expect(screen.queryByText('persisted reply')).not.toBeInTheDocument();
    expect(screen.getByText(/ask follow-up questions/i)).toBeInTheDocument();
    expect(localStorage.getItem('rca-chat:rep-7')).toBeNull();
  });

  it('loads a previously persisted conversation on mount', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'rca-chat:rep-9',
      JSON.stringify([{ role: 'assistant', content: 'earlier answer' }]),
    );
    const api = makeApi(async () => {});
    render(<RCAChatDrawer reportId="rep-9" chatContext={chatContext(api)} />);
    await openDrawer(user);

    expect(screen.getByText('earlier answer')).toBeInTheDocument();
  });

  it('surfaces an error event from the agent', async () => {
    const user = userEvent.setup();
    const api = makeApi(async (_req, _routing, onEvent) => {
      onEvent(ev({ type: 'error', message: 'agent exploded' }));
    });
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText('Message Portal Assistant'),
      'boom{Enter}',
    );

    expect(await screen.findByText('agent exploded')).toBeInTheDocument();
  });

  it('aborts the in-flight stream when Stop is clicked', async () => {
    const user = userEvent.setup();
    let captured: AbortSignal | undefined;
    const api = makeApi(
      (_req, _routing, onEvent, signal) =>
        new Promise<void>((_resolve, reject) => {
          // Emit partial output, then stay in-flight until aborted and
          // reject like a real fetch would when its signal fires —
          // exercising the AbortError branch (and the partial-content
          // recovery) of the catch.
          captured = signal;
          onEvent(ev({ type: 'message_chunk', content: 'partial answer' }));
          signal?.addEventListener('abort', () => {
            const abortErr = new Error('aborted');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        }),
    );
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText('Message Portal Assistant'),
      'long task{Enter}',
    );

    const stop = await screen.findByRole('button', { name: /stop/i });
    await user.click(stop);

    await waitFor(() => expect(captured?.aborted).toBe(true));
    // Partial output is preserved (marked cancelled) and the composer
    // returns to its idle (send) state without surfacing an error.
    expect(
      await screen.findByText('partial answer (cancelled)'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send message/i }),
    ).toBeInTheDocument();
  });

  it('shows an error when the stream throws', async () => {
    const user = userEvent.setup();
    const api = makeApi(async () => {
      throw new Error('network down');
    });
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText('Message Portal Assistant'),
      'boom{Enter}',
    );

    expect(await screen.findByText('network down')).toBeInTheDocument();
  });

  it('closes the drawer from the header close button', async () => {
    const user = userEvent.setup();
    const api = makeApi(async () => {});
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);
    expect(
      screen.getByPlaceholderText('Message Portal Assistant'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /close portal assistant chat/i }),
    );

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Message Portal Assistant'),
      ).not.toBeInTheDocument(),
    );
  });

  it('closes the drawer on Escape', async () => {
    const user = userEvent.setup();
    const api = makeApi(async () => {});
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);
    expect(
      screen.getByPlaceholderText('Message Portal Assistant'),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText('Message Portal Assistant'),
      ).not.toBeInTheDocument(),
    );
  });

  it('renders inline markdown in assistant replies', async () => {
    const user = userEvent.setup();
    const api = makeApi(async (_req, _routing, onEvent) => {
      onEvent(ev({ type: 'done', message: 'see the **bold** word' }));
    });
    render(<RCAChatDrawer reportId="rep-1" chatContext={chatContext(api)} />);
    await openDrawer(user);

    await user.type(
      screen.getByPlaceholderText('Message Portal Assistant'),
      'hi{Enter}',
    );

    // Bold span proves the markdown pipeline (and the non-string branch
    // of processChildren) ran.
    expect(await screen.findByText('bold')).toBeInTheDocument();
  });

  it('falls back to an empty conversation when stored data is corrupt', async () => {
    const user = userEvent.setup();
    localStorage.setItem('rca-chat:rep-bad', '{not valid json');
    const api = makeApi(async () => {});
    render(<RCAChatDrawer reportId="rep-bad" chatContext={chatContext(api)} />);
    await openDrawer(user);

    expect(screen.getByText(/ask follow-up questions/i)).toBeInTheDocument();
  });
});
