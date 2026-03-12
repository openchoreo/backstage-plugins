import { ClusterRole, PolicyEffect, UserTypeConfig } from '../../hooks';
import { getK8sNameError } from './utils';

/**
 * A single role mapping entry in the wizard (role + optional scope)
 */
export interface WizardRoleMapping {
  /** Role name */
  role: string;
  /** Role namespace (empty for cluster roles) */
  roleNamespace: string;
  /** Scope - namespace (cluster bindings only) */
  namespace: string;
  /** Scope - project */
  project: string;
  /** Scope - component */
  component: string;
  /** Whether this row has been confirmed by the user */
  confirmed: boolean;
}

/**
 * Wizard state representing all form data across steps
 */
export interface WizardState {
  // Step 1: Subject
  subjectType: string;
  entitlementValue: string;

  // Step 2: Role Mappings
  roleMappings: WizardRoleMapping[];

  // Step 3: Effect + Name
  effect: PolicyEffect;
  name: string;
}

/**
 * Step definitions
 */
export type WizardStepId = 'subject' | 'roleMappings' | 'effect' | 'review';

export interface WizardStepDef {
  id: WizardStepId;
  label: string;
  description: string;
}

export const WIZARD_STEPS: WizardStepDef[] = [
  { id: 'subject', label: 'Subject', description: 'Define who gets this role' },
  {
    id: 'roleMappings',
    label: 'Role Mappings',
    description: 'Configure role and scope pairs',
  },
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
    subjectType: userTypes[0]?.type || '',
    entitlementValue: '',
    roleMappings: [
      {
        role: '',
        roleNamespace: '',
        namespace: '',
        project: '',
        component: '',
        confirmed: false,
      },
    ],
    effect: 'allow',
    name: '',
  };
}

/**
 * Validation helpers
 */
export function isStepValid(stepId: WizardStepId, state: WizardState): boolean {
  switch (stepId) {
    case 'subject':
      return !!state.subjectType && !!state.entitlementValue.trim();
    case 'roleMappings':
      return (
        state.roleMappings.length > 0 &&
        state.roleMappings.every(rm => !!rm.role && rm.confirmed)
      );
    case 'effect':
      return (
        (state.effect === 'allow' || state.effect === 'deny') &&
        !getK8sNameError(state.name)
      );
    case 'review':
      return true;
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
