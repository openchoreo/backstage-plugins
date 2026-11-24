import type { ReactNode } from 'react';
import Button from '@material-ui/core/Button';
import SvgIcon, { type SvgIconProps } from '@material-ui/core/SvgIcon';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import {
  factFieldsOf,
  kindsOfFilter,
  type DynamicCheck,
  type FactSchema,
} from '@openchoreo/backstage-plugin-tech-insights-scorecards';
import type { ChatScope, FactRetriever } from '../../api/PortalAssistantApi';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';

/** Scope fields that tell the agent which existing check is being edited. */
function editingScope(check: DynamicCheck): Partial<ChatScope> {
  return {
    checkId: check.id,
    checkName: check.name,
    ...(check.description ? { checkDescription: check.description } : {}),
    currentRule: JSON.stringify(check.rule.conditions),
    ...(check.factIds.length > 0 ? { selectedFactIds: check.factIds } : {}),
  };
}

/**
 * Sparkle glyph (Material "auto_awesome") marking the button as an AI
 * feature. @material-ui/icons v4 doesn't ship it, so the path is inlined.
 */
const AiSparkleIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
  </SvgIcon>
);

/**
 * Opens the Portal Assistant drawer scoped to check authoring.
 *
 * The registered fact schemas are forwarded as
 * `ChatScope.availableFactRetrievers` so the agent only references facts
 * that actually exist instead of inventing names.
 *
 * When `check` is set, the check's id, text and current rule are forwarded
 * too, and each check gets its own conversation so edits to different checks
 * don't mix.
 */
function useOpenCheckAuthoring() {
  const { openDrawer } = useAssistantDrawer();

  return (
    factSchemas: FactSchema[],
    check?: DynamicCheck,
    onChecksChanged?: () => void,
  ) => {
    const availableFactRetrievers: FactRetriever[] = factSchemas.map(schema => {
      const kinds = kindsOfFilter(schema.entityFilter);
      return {
        id: schema.id,
        ...(kinds === 'all' ? {} : { kinds }),
        facts: factFieldsOf(schema).map(f => ({
          name: f.name,
          type: f.field.type,
          description: f.field.description,
        })),
      };
    });

    const overrides: Partial<ChatScope> = {
      caseType: 'check_authoring',
      ...(availableFactRetrievers.length > 0
        ? { availableFactRetrievers }
        : {}),
      ...(check ? editingScope(check) : {}),
    };

    openDrawer({
      scopeOverrides: overrides,
      // Stable key: re-opening this button resumes the same conversation
      // rather than starting a fresh one each time, matching the "generic
      // FAB" convention documented in OpenAssistantOptions.conversationKey.
      // One conversation per edited check, one shared for new checks.
      conversationKey: check
        ? `check_authoring:${check.id}`
        : 'check_authoring',
      onChecksChanged,
    });
  };
}

/**
 * "Edit with AI", rendered on the check edit page and dialog, through the
 * scorecards plugin's `checkAuthoringAssistantApiRef` slot (see
 * ../../alpha.tsx).
 */
export const EditCheckWithAiButton = ({
  factSchemas,
  check,
  onChecksChanged,
}: {
  factSchemas: FactSchema[];
  check: DynamicCheck;
  onChecksChanged?: () => void;
}) => {
  const enabled = useAssistantEnabled();
  const openCheckAuthoring = useOpenCheckAuthoring();

  if (!enabled) return null;

  return (
    <Button
      variant="outlined"
      size="small"
      color="primary"
      startIcon={<AiSparkleIcon fontSize="small" />}
      onClick={() => openCheckAuthoring(factSchemas, check, onChecksChanged)}
    >
      Edit with AI
    </Button>
  );
};

/**
 * Backs "Generate with AI" in the scorecards "Create check" menu: hands the
 * menu a function that opens the assistant on a new check, or undefined when
 * the assistant is turned off so the menu can be skipped.
 */
export const NewCheckLauncher = ({
  factSchemas,
  onChecksChanged,
  children,
}: {
  factSchemas: FactSchema[];
  onChecksChanged?: () => void;
  children: (openAssistant?: () => void) => ReactNode;
}) => {
  const enabled = useAssistantEnabled();
  const openCheckAuthoring = useOpenCheckAuthoring();

  return (
    <>
      {children(
        enabled
          ? () => openCheckAuthoring(factSchemas, undefined, onChecksChanged)
          : undefined,
      )}
    </>
  );
};
