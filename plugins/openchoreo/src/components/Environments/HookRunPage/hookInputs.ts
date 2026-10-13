import type { HookParameter } from '@openchoreo/backstage-plugin-common';
import {
  PARAMETER_SOURCE_LABELS,
  parameterSource,
} from '../../HookOverview/hookSpec';

export interface ResolvedHookInput {
  name: string;
  value: string;
  source: string;
}

const show = (v: unknown): string => {
  if (v === undefined || v === null) return '—';
  return typeof v === 'string' ? v : JSON.stringify(v);
};

/**
 * The inputs a hook run received, each with where its value came from:
 * the binding (when it supplies one), else the hook's own declaration
 * (fixed / from release / default). Values are the run's, so they show what
 * actually ran, not what the spec would produce today.
 */
export function resolveHookInputs(
  runParameters: Record<string, unknown> | undefined,
  hookParameters: HookParameter[] | undefined,
  bindingParameters: Record<string, string> | undefined,
): ResolvedHookInput[] {
  const run = runParameters ?? {};
  const declared = hookParameters ?? [];
  const inputs: ResolvedHookInput[] = declared.map(p => {
    const bound =
      p.value === undefined && bindingParameters?.[p.name] !== undefined;
    return {
      name: p.name,
      value: show(
        run[p.name] ?? (bound ? bindingParameters![p.name] : undefined),
      ),
      source: bound ? 'binding' : PARAMETER_SOURCE_LABELS[parameterSource(p)],
    };
  });
  // Anything else the workflow received (e.g. hook spec changed since).
  for (const [name, v] of Object.entries(run)) {
    if (declared.some(p => p.name === name)) continue;
    inputs.push({ name, value: show(v), source: '' });
  }
  return inputs;
}
