import { ClusterRole, PolicyEffect, UserTypeConfig } from '../../hooks';

/**
 * Wizard state representing all form data across steps
 */
export interface WizardState {
  // Step 1: Role
  selectedRole: string;
  selectedRoleNamespace: string;

  // Step 2: Subject
  subjectType: string;
  entitlementValue: string;

  // Step 3: Scope
  scopeType: 'global' | 'specific';
  namespace: string;
  namespaceUnits: string[];
  project: string;
  component: string;

  // Step 4: Effect + Name
  effect: PolicyEffect;
  name: string;
}

/**
 * Step definitions
 */
export type WizardStepId = 'role' | 'subject' | 'scope' | 'effect' | 'review';

export interface WizardStepDef {
  id: WizardStepId;
  label: string;
  description: string;
}

export const WIZARD_STEPS: WizardStepDef[] = [
  { id: 'role', label: 'Role', description: 'Select a role to assign' },
  { id: 'subject', label: 'Subject', description: 'Define who gets this role' },
  { id: 'scope', label: 'Scope', description: 'Where does this apply' },
  { id: 'effect', label: 'Effect', description: 'Allow or deny' },
  { id: 'review', label: 'Review', description: 'Confirm your mapping' },
];

/**
 * Props for individual step components
 */
export interface WizardStepProps {
  state: WizardState;
  onChange: (updates: Partial<WizardState>) => void;
  availableRoles: ClusterRole[];
  userTypes: UserTypeConfig[];
}

/**
 * Initial state factory
 */
export function createInitialWizardState(
  userTypes: UserTypeConfig[],
): WizardState {
  return {
    selectedRole: '',
    selectedRoleNamespace: '',
    subjectType: userTypes[0]?.type || '',
    entitlementValue: '',
    scopeType: 'global',
    namespace: '',
    namespaceUnits: [],
    project: '',
    component: '',
    effect: 'allow',
    name: '',
  };
}

/**
 * Validation helpers
 */
export function isStepValid(stepId: WizardStepId, state: WizardState): boolean {
  switch (stepId) {
    case 'role':
      return !!state.selectedRole;
    case 'subject':
      return !!state.subjectType && !!state.entitlementValue.trim();
    case 'scope':
      // Global is always valid; specific needs at least namespace or project
      return (
        state.scopeType === 'global' ||
        (state.scopeType === 'specific' &&
          (!!state.namespace || !!state.project))
      );
    case 'effect':
      return (
        (state.effect === 'allow' || state.effect === 'deny') &&
        !getK8sNameError(state.name)
      );
    case 'review':
      return true; // Review step is always valid
    default:
      return false;
  }
}

/**
 * Get the index of a step by ID
 */
export function getStepIndex(stepId: WizardStepId): number {
  return WIZARD_STEPS.findIndex(s => s.id === stepId);
}

/**
 * Check if a step is clickable (all previous steps must be valid)
 */
export function isStepClickable(
  targetStepId: WizardStepId,
  currentStepId: WizardStepId,
  state: WizardState,
): boolean {
  const targetIndex = getStepIndex(targetStepId);
  const currentIndex = getStepIndex(currentStepId);

  // Can always click current step
  if (targetIndex === currentIndex) return true;

  // Can click previous steps (going back)
  if (targetIndex < currentIndex) return true;

  // For forward navigation, all steps up to target must be valid
  for (let i = 0; i < targetIndex; i++) {
    if (!isStepValid(WIZARD_STEPS[i].id, state)) {
      return false;
    }
  }
  return true;
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
