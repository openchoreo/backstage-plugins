import type { ConfirmResult } from '../../api/PortalAssistantApi';
import type { SavedCheck } from '../ConfirmCard/ConfirmCard';
import { createContext, type ReactNode } from 'react';

/** True when the surface's buttons must not be clicked (an old question). */
export const AgentUiDisabled = createContext(false);

/**
 * True under a card's options: "Tell me something else" is then one more
 * row under them, not a section of its own.
 */
export const AgentUiInOptions = createContext(false);

/**
 * True when a newer save card came after this reply: its save card can't
 * be saved any more. Unlike AgentUiDisabled, a later test or question
 * leaves a save card usable.
 */
export const AgentUiSuperseded = createContext(false);

/** Called after a save card saved a check, e.g. to refresh a check list. */
export const AgentUiSaved = createContext<
  ((result: ConfirmResult, saved: SavedCheck) => void) | undefined
>(undefined);

/** A saved check a card found, as the chat carries on with it. */
export type OpenedCheck = Pick<
  SavedCheck,
  'checkId' | 'name' | 'description' | 'rule' | 'factIds' | 'status'
>;

/**
 * Moves the chat to a saved check, as after a save: called when the user
 * chooses to edit the check a card found like their draft. `message` is
 * then sent about it, e.g. the change they asked for.
 */
export const AgentUiOpenCheck = createContext<
  ((check: OpenedCheck, message?: string) => void) | undefined
>(undefined);

/**
 * Renders a reply's Markdown. The drawer passes its own renderer, so the
 * cards show text exactly like the rest of the chat; without one the text
 * is shown as it is.
 */
export const AgentUiMarkdown = createContext<
  ((text: string) => ReactNode) | undefined
>(undefined);

/**
 * The drawer's one message box, for the cards of a check authoring chat, so
 * a card never needs its own text box or Send: `write` puts text in it
 * (what a card's value editors would send), `focus` moves the cursor there
 * with a hint for what to type, keeping what is already typed. Without it
 * a card keeps its own box. A suggestion is sent when clicked either way.
 */
export type AgentUiComposer = {
  write: (text: string) => void;
  focus: (hint?: string) => void;
};
export const AgentUiComposerContext = createContext<
  AgentUiComposer | undefined
>(undefined);
