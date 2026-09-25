import { useEffect } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import { HookBindingRow } from './HookBindingRow';
import {
  EMPTY_HOOK_SET,
  newBinding,
  validateHookBinding,
  type HookBindingFormData,
  type HookOption,
  type HookPhase,
  type HookSetFormData,
  type SubjectTypeOption,
} from './hookBindingValidation';
import { useStyles } from './styles';

interface HookBindingEditorProps {
  environmentName: string;
  hookSet: HookSetFormData | undefined;
  hooks: HookOption[];
  subjectTypes: SubjectTypeOption[];
  onChange: (hookSet: HookSetFormData | undefined) => void;
  /**
   * Show validation errors. Off until the user tries to submit, so a newly
   * added hook does not open covered in errors for fields not filled in yet.
   */
  showErrors?: boolean;
}

const PHASES: { key: HookPhase; title: string; hint: string }[] = [
  {
    key: 'preDeploy',
    title: 'Before deploy',
    hint: 'Run before the release is rendered into the environment. A Sync hook with onFailure=Block stops the deployment.',
  },
  {
    key: 'postDeploy',
    title: 'After deploy',
    hint: 'Run once the release reports ResourcesReady. Alert degrades Ready until acknowledged.',
  },
];

/**
 * "Deployment hooks" section of the environment form. Always shown, with both
 * phases visible, since hooks are part of what an environment is.
 */
export function HookBindingEditor({
  environmentName,
  hookSet,
  hooks,
  subjectTypes,
  onChange,
  showErrors = false,
}: HookBindingEditorProps) {
  const classes = useStyles();
  const set = hookSet ?? EMPTY_HOOK_SET;

  const allNames = [...set.preDeploy, ...set.postDeploy].map(b => b.name);
  const findHook = (b: HookBindingFormData) =>
    hooks.find(
      h => h.kind === (b.hookRef.kind ?? 'Hook') && h.name === b.hookRef.name,
    );

  // Each binding carries its hook's spec so the form's submit-time
  // validation can check parameters without catalog access.
  const withSpec = (b: HookBindingFormData): HookBindingFormData => {
    const spec = findHook(b);
    return spec && b.hookSpec !== spec ? { ...b, hookSpec: spec } : b;
  };
  const emit = (next: HookSetFormData) =>
    onChange(
      next.preDeploy.length + next.postDeploy.length > 0
        ? {
            preDeploy: next.preDeploy.map(withSpec),
            postDeploy: next.postDeploy.map(withSpec),
          }
        : undefined,
    );

  // Bindings loaded from YAML get their spec once the hook list arrives.
  useEffect(() => {
    if (!hookSet) return;
    const stale = [...hookSet.preDeploy, ...hookSet.postDeploy].some(
      b => withSpec(b) !== b,
    );
    if (stale) emit(hookSet);
    // Only when the hook list changes; emit/withSpec close over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hooks]);

  const add = (phase: HookPhase) => {
    const first = hooks[0];
    const binding: HookBindingFormData = first
      ? newBinding(first, phase)
      : {
          name: '',
          hookRef: { kind: 'Hook', name: '' },
          mode: 'Sync',
          onFailure: phase === 'preDeploy' ? 'Block' : 'Ignore',
          timeout: '30m',
          retries: 0,
          appliesTo: [],
          parameters: {},
        };
    if (allNames.includes(binding.name)) {
      binding.name = `${binding.name}-${set[phase].length + 1}`;
    }
    emit({ ...set, [phase]: [...set[phase], binding] });
  };

  const update = (phase: HookPhase, index: number, b: HookBindingFormData) => {
    const list = [...set[phase]];
    list[index] = b;
    emit({ ...set, [phase]: list });
  };

  const remove = (phase: HookPhase, index: number) => {
    const list = [...set[phase]];
    list.splice(index, 1);
    emit({ ...set, [phase]: list });
  };

  return (
    <Box className={classes.hooksSection} data-testid="hooks-section">
      <Typography variant="h6" component="h3" className={classes.hooksTitle}>
        Deployment hooks
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Hooks bound here run for every deployment into{' '}
        {environmentName ? (
          <strong>{environmentName}</strong>
        ) : (
          'this environment'
        )}
        , whichever path the release took.
      </Typography>
      {PHASES.map(({ key, title, hint }) => (
        <Box key={key} mt={2}>
          <Typography
            variant="subtitle2"
            component="h4"
            className={classes.phaseTitle}
          >
            {title}
          </Typography>
          <Typography variant="caption" color="textSecondary" component="p">
            {hint}
          </Typography>
          {set[key].length === 0 && (
            <Typography
              variant="body2"
              color="textSecondary"
              className={classes.emptyPhase}
            >
              No {key === 'preDeploy' ? 'pre-deploy' : 'post-deploy'} hooks.
            </Typography>
          )}
          {set[key].map((b, i) => (
            <HookBindingRow
              key={`${key}-${i}`}
              binding={b}
              phase={key}
              hooks={hooks}
              subjectTypes={subjectTypes}
              errors={validateHookBinding(b, key, allNames, findHook(b))}
              showErrors={showErrors}
              onChange={next => update(key, i, next)}
              onRemove={() => remove(key, i)}
            />
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => add(key)}
            className={classes.addButton}
            data-testid={`add-hook-${key}`}
          >
            Add {key === 'preDeploy' ? 'pre-deploy' : 'post-deploy'} hook
          </Button>
        </Box>
      ))}
    </Box>
  );
}
