import { BindingScope, SCOPE_CLUSTER } from '../../constants';
import { WizardRoleMapping } from './types';

/**
 * Build a human-readable scope path like `ns:default/proj:myproj/*` from a wizard role mapping.
 */
export function buildScopePath(
  rm: Pick<WizardRoleMapping, 'namespace' | 'project' | 'component'>,
  bindingType?: BindingScope,
  namespace?: string,
): string {
  if (bindingType === SCOPE_CLUSTER) {
    if (!rm.namespace && !rm.project && !rm.component) return 'cluster:*';
    const parts: string[] = [];
    if (rm.namespace) {
      parts.push(`ns:${rm.namespace}`);
      if (rm.project) {
        parts.push(`proj:${rm.project}`);
        if (rm.component) {
          parts.push(`comp:${rm.component}`);
        } else {
          parts.push('*');
        }
      } else {
        parts.push('*');
      }
    }
    return parts.join('/');
  }
  const ns = namespace || '*';
  if (!rm.project && !rm.component) return `ns:${ns}/*`;
  const parts: string[] = [`ns:${ns}`];
  if (rm.project) {
    parts.push(`proj:${rm.project}`);
    if (rm.component) {
      parts.push(`comp:${rm.component}`);
    } else {
      parts.push('*');
    }
  }
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
