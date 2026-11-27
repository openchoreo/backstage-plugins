import { useState } from 'react';
import Button from '@material-ui/core/Button';
import { DryRunEntityField } from '@openchoreo/backstage-plugin-tech-insights-scorecards';
import { useButtonStyles } from '../AgentUi/cardStyles';

/** kind:namespace/name, as a picked entity fills in. */
const FULL_REF_RE = /^[^:/\s]+:[^:/\s]+\/[^:/\s]+$/;

/**
 * The check form's entity field with a Test button, to test a check on an
 * entity from the chat. Test needs a full ref, such as
 * component:default/order-api, which picking an entity fills in, so the
 * agent never guesses a namespace.
 */
export const ComponentPicker = ({
  kinds,
  disabled = false,
  onTest,
}: {
  /** Kinds to list; every kind when empty. */
  kinds: string[];
  disabled?: boolean;
  /** Called with the entity's ref when Test is clicked. */
  onTest: (entityRef: string) => void;
}) => {
  const buttonClasses = useButtonStyles();
  const [entityRef, setEntityRef] = useState('');
  const ready = FULL_REF_RE.test(entityRef.trim()) && !disabled;

  return (
    <DryRunEntityField
      kinds={kinds}
      value={entityRef}
      onChange={setEntityRef}
      label="Entity to test on"
      disabled={disabled}
      action={
        <Button
          size="small"
          variant="contained"
          className={`${buttonClasses.button} ${
            ready ? buttonClasses.primary : ''
          }`}
          disabled={!ready}
          onClick={() => onTest(entityRef.trim())}
        >
          Test
        </Button>
      }
    />
  );
};
