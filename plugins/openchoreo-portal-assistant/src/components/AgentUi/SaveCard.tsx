import { useContext } from 'react';
import { z } from 'zod';
import { createBinderlessComponentImplementation } from '@a2ui/react';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import type { ConfirmationRequired } from '../../api/PortalAssistantApi';
import { ConfirmCard } from '../ConfirmCard/ConfirmCard';
import { children, type ChildRef } from './cardStyles';
import { AgentUiMarkdown, AgentUiSaved, AgentUiSuperseded } from './context';

/**
 * The confirm card of a check change, sent by the agent as an A2UI surface.
 * `card` is the `confirmation_required` event's data, unchanged — this
 * renders the same ConfirmCard, so saving works exactly as before: the
 * signed token, the chosen status and the suggested texts go to
 * /chat/confirm. `plain` adds the rule in plain words and `note` the reply's
 * own words, since the drawer shows this card instead of the reply's text;
 * `resultTitle` and `result` the test it was just tried in
 * (src/agent/a2ui.py).
 */
export const SaveCardApi = {
  name: 'SaveCard',
  schema: z.object({
    card: z
      .object({
        token: z.string(),
        kind: z.enum(['update', 'create']),
        check_name: z.string(),
        new_rule: z.string(),
        valid: z.boolean(),
      })
      .passthrough(),
    plain: CommonSchemas.ChildList,
    note: z.string().optional(),
    // The test it was just tried in: a heading, its result (highlighted)
    // and one line per fact.
    resultTitle: z.string().optional(),
    resultStatus: z.enum(['passed', 'failed', 'not-applicable']).optional(),
    result: CommonSchemas.ChildList.optional(),
  }),
};

type SaveCardProps = {
  card: Omit<ConfirmationRequired, 'type'>;
  plain?: ChildRef[];
  note?: string;
  resultTitle?: string;
  resultStatus?: 'passed' | 'failed' | 'not-applicable';
  result?: ChildRef[];
};

// Binderless: the card's data reaches ConfirmCard exactly as the agent sent
// it, with no A2UI binding applied to the strings in it.
export const SaveCard = createBinderlessComponentImplementation(
  SaveCardApi,
  ({ context, buildChild }) => {
    const onSaved = useContext(AgentUiSaved);
    const superseded = useContext(AgentUiSuperseded);
    const renderMarkdown = useContext(AgentUiMarkdown);
    const { card, plain, note, resultTitle, resultStatus, result } = context
      .componentModel.properties as unknown as SaveCardProps;
    return (
      <ConfirmCard
        card={{ ...card, type: 'confirmation_required' }}
        onSaved={onSaved}
        superseded={superseded}
        plain={
          plain && plain.length > 0 ? children(plain, buildChild) : undefined
        }
        note={note && (renderMarkdown ? renderMarkdown(note) : note)}
        testResult={
          resultTitle
            ? {
                title: resultTitle,
                status: resultStatus,
                lines:
                  result && result.length > 0
                    ? children(result, buildChild)
                    : undefined,
              }
            : undefined
        }
      />
    );
  },
);
