import type {
  DeploymentGateStatus,
  DeploymentHookStatus,
  HookBinding,
  HookFailurePolicy,
  HookMode,
  HookRef,
  HookSet,
} from '@openchoreo/backstage-plugin-common';

/** Gate phase a binding belongs to; matches the retry API's `phase`. */
export type HookGatePhase = 'preDeploy' | 'postDeploy';

/**
 * How a hook row reads on the Deploy tab:
 * - `running`: started and not finished
 * - `ok`: succeeded (Sync) or dispatched (Async)
 * - `fail`: failed and its policy blocks or alerts
 * - `ignored`: failed, but the binding ignores failures
 * - `skipped`: not run for this component (e.g. hook not enabled for its type)
 * - `pending`: bound but not started for the current release
 */
export type HookRowState =
  | 'running'
  | 'ok'
  | 'fail'
  | 'ignored'
  | 'skipped'
  | 'pending';

export interface HookRow {
  /** Binding name */
  name: string;
  phase: HookGatePhase;
  hookRef?: HookRef;
  mode: HookMode;
  /** Effective policy for a failed Sync hook (CRD defaults applied) */
  onFailure: HookFailurePolicy;
  state: HookRowState;
  /** Human-readable state, e.g. "Failed, ignored" */
  stateText: string;
  status?: DeploymentHookStatus;
  /** The environment's binding; absent when it was removed after the run */
  binding?: HookBinding;
}

export interface EnvironmentHooks {
  pre: HookRow[];
  post: HookRow[];
}

const FAILED_PHASES = new Set([
  'Failed',
  'TimedOut',
  'DispatchFailed',
  'PlaneUnavailable',
]);

/** CRD defaults: Block for pre-deploy, Ignore for post-deploy. */
export function effectiveOnFailure(
  binding: Pick<HookBinding, 'onFailure'> | undefined,
  phase: HookGatePhase,
): HookFailurePolicy {
  return binding?.onFailure ?? (phase === 'preDeploy' ? 'Block' : 'Ignore');
}

function rowState(
  status: DeploymentHookStatus | undefined,
  mode: HookMode,
  onFailure: HookFailurePolicy,
  phase: HookGatePhase,
): { state: HookRowState; stateText: string } {
  const p = status?.phase;
  if (!p || (p === 'Pending' && !status?.workflowRunRef)) {
    return {
      state: 'pending',
      stateText: phase === 'preDeploy' ? 'Not started' : 'Waiting for deploy',
    };
  }
  if (p === 'Pending' || p === 'Running') {
    return { state: 'running', stateText: 'Running' };
  }
  if (p === 'Succeeded') return { state: 'ok', stateText: 'Succeeded' };
  if (p === 'Dispatched') return { state: 'ok', stateText: 'Dispatched' };
  if (p === 'Skipped') return { state: 'skipped', stateText: 'Skipped' };
  if (FAILED_PHASES.has(p)) {
    const label = p === 'TimedOut' ? 'Timed out' : 'Failed';
    // Async hooks never gate the deploy; Ignore lets it through.
    if (mode === 'Async' || onFailure === 'Ignore') {
      return { state: 'ignored', stateText: `${label}, ignored` };
    }
    return { state: 'fail', stateText: label };
  }
  return { state: 'pending', stateText: p };
}

function phaseRows(
  phase: HookGatePhase,
  bindings: HookBinding[] | undefined,
  statuses: DeploymentHookStatus[] | undefined,
): HookRow[] {
  const byName = new Map((statuses ?? []).map(s => [s.name, s]));
  const rows: HookRow[] = [];
  const seen = new Set<string>();
  // Bindings first, in the order the environment declares them; then any
  // gate entry whose binding was removed since the gate ran.
  for (const b of bindings ?? []) {
    const status = byName.get(b.name);
    const mode = status?.mode ?? b.mode ?? 'Sync';
    const onFailure = effectiveOnFailure(b, phase);
    rows.push({
      name: b.name,
      phase,
      hookRef: b.hookRef,
      mode,
      onFailure,
      ...rowState(status, mode, onFailure, phase),
      status,
      binding: b,
    });
    seen.add(b.name);
  }
  for (const s of statuses ?? []) {
    if (seen.has(s.name)) continue;
    const mode = s.mode ?? 'Sync';
    const onFailure = effectiveOnFailure(undefined, phase);
    rows.push({
      name: s.name,
      phase,
      hookRef: s.hookRef,
      mode,
      onFailure,
      ...rowState(s, mode, onFailure, phase),
      status: s,
    });
  }
  return rows;
}

/**
 * Hook rows of one environment for the Deploy tab: the environment's
 * bindings (policy, and hooks not yet started) merged with the release
 * binding's gate (live status for the current release).
 */
export function deriveEnvironmentHooks(
  bindings: HookSet | undefined,
  gate: DeploymentGateStatus | undefined,
): EnvironmentHooks {
  return {
    pre: phaseRows('preDeploy', bindings?.preDeploy, gate?.preDeploy),
    post: phaseRows('postDeploy', bindings?.postDeploy, gate?.postDeploy),
  };
}

export function hasHooks(hooks: EnvironmentHooks | undefined): boolean {
  return !!hooks && hooks.pre.length + hooks.post.length > 0;
}

/** "1/2" = succeeded or dispatched out of bound; empty when none bound. */
export function hookSummary(rows: HookRow[]): string {
  if (rows.length === 0) return '';
  return `${rows.filter(r => r.state === 'ok').length}/${rows.length}`;
}

/** The first failed hook that stops or alerts the deployment, if any. */
export function blockingFailure(
  hooks: EnvironmentHooks | undefined,
): HookRow | undefined {
  return [...(hooks?.pre ?? []), ...(hooks?.post ?? [])].find(
    r => r.state === 'fail',
  );
}

// Card layout: a section header plus one row per hook, per phase.
export const HOOK_SECTION_HEADER_HEIGHT = 22;
export const HOOK_ROW_HEIGHT = 30;
// Divider, padding and the card body's gap above each section.
const HOOK_SECTION_GAP = 15;

/** Extra card height the hook sections need on the deploy canvas. */
export function hookSectionsHeight(hooks: EnvironmentHooks | undefined) {
  if (!hasHooks(hooks)) return 0;
  const section = (rows: HookRow[]) =>
    rows.length === 0
      ? 0
      : HOOK_SECTION_GAP +
        HOOK_SECTION_HEADER_HEIGHT +
        rows.length * HOOK_ROW_HEIGHT;
  return section(hooks!.pre) + section(hooks!.post);
}
