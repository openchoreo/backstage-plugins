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
