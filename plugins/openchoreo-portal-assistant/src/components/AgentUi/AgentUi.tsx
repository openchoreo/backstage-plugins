import { useMemo, useRef, type ReactNode } from 'react';
import Box from '@material-ui/core/Box';
import { A2uiSurface, type ReactCatalogComponent } from '@a2ui/react';
import {
  MessageProcessor,
  type ProcessableMessagePayload,
} from '@a2ui/web_core/v1_0';
import type { ChatAction, ConfirmResult } from '../../api/PortalAssistantApi';
import type { SavedCheck } from '../ConfirmCard/ConfirmCard';
import { AgentUiDisabled, agentUiCatalog } from './catalog';
import {
  AgentUiComposerContext,
  AgentUiMarkdown,
  AgentUiOpenCheck,
  AgentUiSaved,
  AgentUiSuperseded,
  type AgentUiComposer,
  type OpenedCheck,
} from './context';

/** A button's event as a message's action: its name and plain context. */
function chatAction(action: {
  name: string;
  context?: Record<string, unknown>;
}): ChatAction {
  const context = Object.fromEntries(
    Object.entries(action.context ?? {}).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === 'string' || typeof entry[1] === 'number',
    ),
  );
  return Object.keys(context).length > 0
    ? { name: action.name, context }
    : { name: action.name };
}

/**
 * Renders the A2UI messages the agent sent with a reply (an `a2ui` stream
 * event) under that reply. A button's `userMessage` goes to `onAction`,
 * which sends it as the user's next chat message, with the button's event
 * name and context as the message's action: the agent follows that, not the
 * words. Messages that A2UI rejects render nothing, so a
 * bad payload never breaks the chat.
 */
export const AgentUi = ({
  messages,
  disabled = false,
  superseded = false,
  onAction,
  onSaved,
  onOpenCheck,
  renderMarkdown,
  composer,
}: {
  messages: unknown[];
  /** Old questions and replies still loading can't be answered. */
  disabled?: boolean;
  /** A newer save card came after this one: it can't be saved. */
  superseded?: boolean;
  onAction: (userMessage: string, action: ChatAction) => void;
  /** Called after a save card saved a check, with the check as saved. */
  onSaved?: (result: ConfirmResult, saved: SavedCheck) => void;
  /** Moves the chat to a saved check a card found like the user's draft. */
  onOpenCheck?: (check: OpenedCheck, message?: string) => void;
  /** Renders a reply's Markdown in a message card, like the chat does. */
  renderMarkdown?: (text: string) => ReactNode;
  /** The drawer's message box, for cards to type into (check authoring). */
  composer?: AgentUiComposer;
}) => {
  // The processor is built once per payload; these keep its handler current.
  const latest = useRef({ disabled, onAction });
  latest.current = { disabled, onAction };

  const surfaces = useMemo(() => {
    try {
      const processor = new MessageProcessor<ReactCatalogComponent>(
        [agentUiCatalog],
        action => {
          const text = action.userMessage;
          if (!latest.current.disabled && typeof text === 'string' && text) {
            latest.current.onAction(text, chatAction(action));
          }
        },
      );
      // The agent's JSON; the processor checks each message itself.
      processor.processMessages(messages as ProcessableMessagePayload);
      return Array.from(processor.model.surfacesMap.values());
    } catch {
      return [];
    }
  }, [messages]);

  if (surfaces.length === 0) return null;
  return (
    <AgentUiComposerContext.Provider value={composer}>
      <AgentUiMarkdown.Provider value={renderMarkdown}>
        <AgentUiSaved.Provider value={onSaved}>
          <AgentUiOpenCheck.Provider value={onOpenCheck}>
            <AgentUiSuperseded.Provider value={superseded}>
              <AgentUiDisabled.Provider value={disabled}>
                <Box mt={1} data-testid="agent-ui">
                  {surfaces.map(surface => (
                    <A2uiSurface key={surface.id} surface={surface} />
                  ))}
                </Box>
              </AgentUiDisabled.Provider>
            </AgentUiSuperseded.Provider>
          </AgentUiOpenCheck.Provider>
        </AgentUiSaved.Provider>
      </AgentUiMarkdown.Provider>
    </AgentUiComposerContext.Provider>
  );
};

const hasComponent = (messages: unknown[] | undefined, name: string) =>
  (messages ?? []).some(message =>
    (
      message as { createSurface?: { components?: { component?: string }[] } }
    )?.createSurface?.components?.some(c => c?.component === name),
  );

/**
 * Whether the agent sent a card that replaces the reply's text: a change
 * card (the reply's sentence and the rules in plain words), an ask card (an
 * edit reply that asks instead of proposing), a notice card (a reply that
 * drafts no rule), a test card (a dry-run's result), a reply card (one the
 * model filled for its other
 * replies), a message card (the reply's text in a card when it didn't) or
 * a save card (the drafted check, with the reply's own words) or an
 * existing check card (a saved check like the drafted one, in place of its
 * save card). The drawer shows the card instead of the text; the full reply
 * stays in the chat history for the agent.
 */
export const hasReplyCard = (messages: unknown[] | undefined) =>
  [
    'ChangeCard',
    'AskCard',
    'NoticeCard',
    'TestCard',
    'ReplyCard',
    'MessageCard',
    'SaveCard',
    'ExistingCheckCard',
  ].some(name => hasComponent(messages, name));

/**
 * Whether the agent sent the confirm card as an A2UI save card: the drawer
 * then shows that one instead of drawing the `confirmation_required` event.
 */
export const hasSaveCard = (messages: unknown[] | undefined) =>
  hasComponent(messages, 'SaveCard');
