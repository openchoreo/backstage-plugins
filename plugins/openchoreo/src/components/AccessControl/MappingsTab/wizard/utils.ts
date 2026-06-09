import { BindingScope, SCOPE_CLUSTER } from '../../constants';
import { ActionInfo } from '../../hooks';
import { WizardRoleMapping } from './types';

/**
 * Expand `role:*` wildcards into concrete action names from the catalog.
 * ex: `["releasebindings:*"]` => `["releasebindings:create", "releasebindings:delete", ...]`
 */
export function expandWildcardRoleActions(
  roleActions: string[],
  actionCatalog: ActionInfo[],
): string[] {
  return Array.from(
    new Set(
      roleActions.flatMap(a => {
        if (!a.endsWith(':*')) return [a];
        const prefix = a.slice(0, -1);
        return actionCatalog
          .map(ac => ac.name)
          .filter(name => name.startsWith(prefix));
      }),
    ),
  );
}

/**
 * Return the subset of a role's actions (with wildcards expanded) that the
 * catalog marks as having condition predicates.
 */
export function getConditionableActions(
  roleActions: string[],
  actionCatalog: ActionInfo[],
): string[] {
  return expandWildcardRoleActions(roleActions, actionCatalog).filter(name => {
    const info = actionCatalog.find(ac => ac.name === name);
    return (info?.conditions?.length ?? 0) > 0;
  });
}

/** Attribute keys an action supports for conditions. */
function supportedConditions(
  name: string,
  actionCatalog: ActionInfo[],
): string[] {
  const info = actionCatalog.find(ac => ac.name === name);
  return (info?.conditions ?? []).map(c => c.key);
}

/**
 * Conditionable actions compatible with the current selection — those sharing
 * at least one attribute key, since a condition's expression may only use
 * attributes common to every action it covers. Selected actions are retained.
 */
export function getCompatibleConditionActions(
  selectedActions: string[],
  roleActions: string[],
  actionCatalog: ActionInfo[],
): string[] {
  const conditionable = getConditionableActions(roleActions, actionCatalog);
  if (selectedActions.length === 0) return conditionable;

  let sharedConds = new Set(
    supportedConditions(selectedActions[0], actionCatalog),
  );
  for (const name of selectedActions.slice(1)) {
    const keys = new Set(supportedConditions(name, actionCatalog));
    sharedConds = new Set([...sharedConds].filter(k => keys.has(k)));
  }

  if (sharedConds.size === 0) return [...selectedActions];

  const hasSharedCondition = (name: string) =>
    supportedConditions(name, actionCatalog).some(k => sharedConds.has(k));

  return conditionable.filter(
    name => selectedActions.includes(name) || hasSharedCondition(name),
  );
}

/**
 * Build a human-readable scope path like `ns:default/proj:myproj/*` from a wizard role mapping.
 */
export function buildScopePath(
  rm: Pick<WizardRoleMapping, 'namespace' | 'project' | 'component'>,
  bindingType?: BindingScope,
  namespace?: string,
): string {
  if (bindingType === SCOPE_CLUSTER) {
    if (!rm.namespace && (rm.project || rm.component)) return '';
    if (!rm.project && rm.component) return '';
    if (!rm.namespace) return 'cluster:*';
    const parts: string[] = [`ns:${rm.namespace}`];
    if (rm.project) {
      parts.push(`proj:${rm.project}`);
      parts.push(rm.component ? `comp:${rm.component}` : '*');
    } else {
      parts.push('*');
    }
    return parts.join('/');
  }
  if (!namespace && (rm.project || rm.component)) return '';
  if (!rm.project && rm.component) return '';
  const ns = namespace || '*';
  if (!rm.project) return `ns:${ns}/*`;
  const parts: string[] = [`ns:${ns}`, `proj:${rm.project}`];
  parts.push(rm.component ? `comp:${rm.component}` : '*');
  return parts.join('/');
}

/**
 * Sanitize a string into a valid Kubernetes name (RFC 1123 DNS label):
 * lowercase alphanumeric or '-', must start/end with alphanumeric, max 63 chars.
 */
export function toK8sName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}

const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Validate a binding name against RFC 1123 DNS label rules.
 * Returns a human-readable error string, or null if valid.
 */
export function getK8sNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Name is required';
  if (trimmed.length > 63) return 'Must be 63 characters or less';
  if (!/^[a-z0-9]/.test(trimmed))
    return 'Must start with a lowercase letter or number';
  if (!/[a-z0-9]$/.test(trimmed))
    return 'Must end with a lowercase letter or number';
  if (!K8S_NAME_REGEX.test(trimmed))
    return 'Only lowercase letters, numbers, and hyphens are allowed';
  return null;
}
