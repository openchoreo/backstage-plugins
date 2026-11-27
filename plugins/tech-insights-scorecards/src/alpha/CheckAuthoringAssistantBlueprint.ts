import {
  createExtensionBlueprint,
  createExtensionDataRef,
} from '@backstage/frontend-plugin-api';
import type { CheckAuthoringAssistant } from '../api/CheckAuthoringAssistantApi';

const checkAuthoringAssistantDataRef =
  createExtensionDataRef<CheckAuthoringAssistant>().with({
    id: 'tech-insights-scorecards.check-authoring-assistant',
  });

/**
 * Extension blueprint that an assistant plugin uses to add "Generate with AI"
 * and "Edit with AI" to check management, without this plugin depending on
 * it. Each extension attaches to the `assistants` input of
 * `api:tech-insights-scorecards/check-authoring-assistants`, whose factory
 * hands the first one to the check views.
 *
 * @alpha
 */
export const CheckAuthoringAssistantBlueprint = createExtensionBlueprint({
  kind: 'check-authoring-assistant',
  attachTo: {
    id: 'api:tech-insights-scorecards/check-authoring-assistants',
    input: 'assistants',
  },
  dataRefs: {
    assistant: checkAuthoringAssistantDataRef,
  },
  output: [checkAuthoringAssistantDataRef],
  *factory(params: { assistant: CheckAuthoringAssistant }) {
    yield checkAuthoringAssistantDataRef(params.assistant);
  },
});
