import type { Experience } from '../../api/PortalAssistantApi';
import { AGENT_UI_CATALOG_ID } from '../AgentUi/catalog';

/**
 * The first message of a new check's chat, drawn by the drawer (no model
 * call, so it shows at once): the same ReplyCard the agent sends, like the
 * edit intro (editCheckIntro), with the opening's words, the levels to pick
 * and a button to describe your own check (2026-11-25). Like the agent's
 * cards it stays in the chat, read-only once the chat moves on.
 */

/**
 * The levels a check authoring user picks from, in the order shown. A pick
 * sends the level's message as the chat's first; the agent answers it with
 * the welcome for that level. Only "New to checks": a user who knows what
 * they want describes their own check instead (the areas come after the
 * example).
 */
export const EXPERIENCE_LEVELS: {
  value: Experience;
  label: string;
  description: string;
  message: string;
}[] = [
  {
    value: 'beginner',
    label: 'New to checks',
    description: 'Walk me through it, with examples',
    message: "I'm new to checks. Walk me through it, with examples.",
  },
];

/** The card's title. */
export const NEW_CHECK_TITLE = 'Write a new check';

/** The opening's words, the same every time. */
export const OPENING =
  "Checks help every team follow your security standards. Tell me what you'd like to make sure of, and I'll write the check and test it with you. How would you like to start?";

/** The button for a user's own request, instead of a level, and its hint. */
export const OWN_CHECK = 'Describe your own check';
export const OWN_CHECK_HINT =
  'Describe the check you need, for example: repos must be private';

export function newCheckIntro(): unknown[] {
  const choices = EXPERIENCE_LEVELS.map((level, i) => ({
    id: `choice_${i}`,
    component: 'PickRow',
    label: level.label,
    description: level.description,
    text: level.message,
    action: {
      event: {
        name: 'pick_level',
        userMessage: level.message,
        context: { level: level.value },
      },
    },
  }));
  // Same text box as the agent's cards; with the drawer's message box it is
  // the pencil button that points there.
  const text = { '@path': '/reply/text' };
  const answer = {
    id: 'answer',
    component: 'AskField',
    button: OWN_CHECK,
    placeholder: OWN_CHECK_HINT,
    value: text,
    action: { event: { name: 'type_answer', userMessage: text } },
  };
  const root = {
    id: 'root',
    component: 'ReplyCard',
    title: NEW_CHECK_TITLE,
    summary: OPENING,
    sections: [],
    choices: choices.map(choice => choice.id),
    answer: [answer.id],
  };

  return [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'check-new-intro',
        catalogId: AGENT_UI_CATALOG_ID,
        components: [root, ...choices, answer],
      },
    },
  ];
}
