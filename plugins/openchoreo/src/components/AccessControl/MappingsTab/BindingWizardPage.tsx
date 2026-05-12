import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { DetailPageLayout } from '@openchoreo/backstage-plugin-react';
import {
  useUserTypes,
  getEntitlementClaim,
  ClusterRoleBinding,
  NamespaceRoleBinding,
  ClusterRole,
  AuthzCondition,
} from '../hooks';
import {
  ClusterRoleBindingRequest,
  NamespaceRoleBindingRequest,
} from '../../../api/OpenChoreoClientApi';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { SCOPE_CLUSTER, BindingScope } from '../constants';
import {
  WizardState,
  WizardStepId,
  WIZARD_STEPS,
  WizardCondition,
  isStepValid,
  createInitialWizardState,
  WizardStepper,
  SubjectStep,
  RoleMappingsStep,
  EffectStep,
  ReviewStep,
} from './wizard';

const useStyles = makeStyles(theme => ({
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  systemChip: {
    fontSize: '0.7rem',
    height: 20,
  },
  stepCard: {
    marginTop: theme.spacing(2),
  },
  stepContent: {
    minHeight: 350,
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

interface BindingWizardPageProps {
  bindingType: BindingScope;
  editingBinding?: ClusterRoleBinding | NamespaceRoleBinding;
  availableRoles: ClusterRole[];
  namespace?: string;
  onSave: (
    binding: ClusterRoleBindingRequest | NamespaceRoleBindingRequest,
  ) => Promise<void>;
  onCancel: () => void;
}

const newConditionId = () =>
  `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function conditionsFromCrd(
  conditions: AuthzCondition[] | undefined,
): WizardCondition[] {
  return (conditions ?? []).map(c => ({
    id: newConditionId(),
    actions: [...c.actions],
    expression: c.expression,
    confirmed: true,
  }));
}

function conditionsToCrd(
  conditions: WizardCondition[],
): AuthzCondition[] | undefined {
  if (conditions.length === 0) return undefined;
  return conditions.map(c => ({
    actions: [...c.actions],
    expression: c.expression,
  }));
}

export const BindingWizardPage = ({
  bindingType,
  editingBinding,
  availableRoles,
  namespace,
  onSave,
  onCancel,
}: BindingWizardPageProps) => {
  const classes = useStyles();
  const { userTypes } = useUserTypes();

  const [currentStep, setCurrentStep] = useState<WizardStepId>('subject');
  const [wizardState, setWizardState] = useState<WizardState>(() =>
    createInitialWizardState(userTypes),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editingBinding;
  const activeSteps = WIZARD_STEPS;

  useEffect(() => {
    setCurrentStep('subject');
    setError(null);

    if (editingBinding) {
      const matchingUserType = userTypes.find(
        ut => getEntitlementClaim(ut) === editingBinding.entitlement.claim,
      );

      if (bindingType === SCOPE_CLUSTER) {
        const cb = editingBinding as ClusterRoleBinding;
        setWizardState({
          subjectType: matchingUserType?.type || userTypes[0]?.type || '',
          entitlementValue: cb.entitlement.value,
          roleMappings: (cb.roleMappings || []).map(rm => ({
            role: rm.role,
            roleNamespace: '',
            namespace: rm.scope?.namespace || '',
            project: rm.scope?.project || '',
            component: rm.scope?.component || '',
            confirmed: true,
            conditions: conditionsFromCrd(rm.conditions),
          })),
          effect: cb.effect,
          name: cb.name || '',
        });
      } else {
        const nb = editingBinding as NamespaceRoleBinding;
        setWizardState({
          subjectType: matchingUserType?.type || userTypes[0]?.type || '',
          entitlementValue: nb.entitlement.value,
          roleMappings: (nb.roleMappings || []).map(rm => ({
            role: rm.role?.name || '',
            roleNamespace: rm.role?.namespace || '',
            namespace: '',
            project: rm.scope?.project || '',
            component: rm.scope?.component || '',
            confirmed: true,
            conditions: conditionsFromCrd(rm.conditions),
          })),
          effect: nb.effect,
          name: nb.name || '',
        });
      }
    } else {
      setWizardState(createInitialWizardState(userTypes));
    }
  }, [editingBinding, userTypes, bindingType]);

  const handleStateChange = useCallback((updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleStepClick = (stepId: WizardStepId) => setCurrentStep(stepId);

  const handleNext = () => {
    const idx = activeSteps.findIndex(s => s.id === currentStep);
    if (idx < activeSteps.length - 1) {
      setCurrentStep(activeSteps[idx + 1].id);
    }
  };

  const handleBack = () => {
    const idx = activeSteps.findIndex(s => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(activeSteps[idx - 1].id);
    }
  };

  const currentIndex = activeSteps.findIndex(s => s.id === currentStep);
  const isLastStep = currentStep === activeSteps[activeSteps.length - 1].id;
  const isFirstStep = currentStep === activeSteps[0].id;
  const canProceed = isStepValid(currentStep, wizardState);

  const handleSubmit = async () => {
    for (const step of activeSteps) {
      if (!isStepValid(step.id, wizardState)) {
        setError(`Please complete the ${step.label} step`);
        setCurrentStep(step.id);
        return;
      }
    }

    const selectedUserTypeInfo = userTypes.find(
      ut => ut.type === wizardState.subjectType,
    );
    const entitlementClaim = getEntitlementClaim(selectedUserTypeInfo);
    if (!entitlementClaim) {
      setError('Invalid subject type selected');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (bindingType === SCOPE_CLUSTER) {
        const binding: ClusterRoleBindingRequest = {
          name: wizardState.name,
          roleMappings: wizardState.roleMappings.map(rm => ({
            role: rm.role,
            ...(rm.namespace || rm.project || rm.component
              ? {
                  scope: {
                    ...(rm.namespace && { namespace: rm.namespace }),
                    ...(rm.project && { project: rm.project }),
                    ...(rm.component && { component: rm.component }),
                  },
                }
              : {}),
            ...(rm.conditions.length > 0
              ? { conditions: conditionsToCrd(rm.conditions) }
              : {}),
          })),
          entitlement: {
            claim: entitlementClaim,
            value: wizardState.entitlementValue.trim(),
          },
          effect: wizardState.effect,
        };
        await onSave(binding);
      } else {
        const binding: NamespaceRoleBindingRequest = {
          name: wizardState.name,
          roleMappings: wizardState.roleMappings.map(rm => ({
            role: {
              name: rm.role,
              namespace: rm.roleNamespace || undefined,
            },
            ...(rm.project || rm.component
              ? {
                  scope: {
                    ...(rm.project && { project: rm.project }),
                    ...(rm.component && { component: rm.component }),
                  },
                }
              : {}),
            ...(rm.conditions.length > 0
              ? { conditions: conditionsToCrd(rm.conditions) }
              : {}),
          })),
          entitlement: {
            claim: entitlementClaim,
            value: wizardState.entitlementValue.trim(),
          },
          effect: wizardState.effect,
        };
        await onSave(binding);
      }
    } catch (err) {
      if (isForbiddenError(err)) {
        setError(
          'You do not have permission to save this role binding. Contact your administrator.',
        );
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    const stepProps = {
      state: wizardState,
      onChange: handleStateChange,
      availableRoles,
      userTypes,
    };

    switch (currentStep) {
      case 'subject':
        return <SubjectStep {...stepProps} />;
      case 'roleMappings':
        return (
          <RoleMappingsStep
            {...stepProps}
            bindingType={bindingType}
            namespace={namespace}
          />
        );
      case 'effect':
        return (
          <EffectStep
            state={wizardState}
            onChange={handleStateChange}
            isEditMode={isEditMode}
          />
        );
      case 'review':
        return (
          <ReviewStep
            {...stepProps}
            bindingType={bindingType}
            namespace={namespace}
          />
        );
      default:
        return null;
    }
  };

  const titlePrefix = isEditMode ? 'Edit' : 'New';
  const titleScope =
    bindingType === SCOPE_CLUSTER
      ? 'Cluster Role Binding'
      : 'Namespace Role Binding';
  const title = `${titlePrefix} ${titleScope}${
    isEditMode && editingBinding ? `: ${editingBinding.name}` : ''
  }`;

  const isSystemBinding =
    isEditMode && editingBinding?.labels?.[CHOREO_LABELS.SYSTEM] === 'true';

  const subtitleNode = (
    <Box className={classes.subtitle}>
      <Typography variant="body2" color="textSecondary">
        Grant roles to a subject by defining mappings, conditions, and effect.
      </Typography>
      {isSystemBinding && (
        <Chip
          label="System"
          size="small"
          variant="outlined"
          className={classes.systemChip}
        />
      )}
    </Box>
  );

  const primaryActionLabel = (() => {
    if (isLastStep) {
      if (saving) return isEditMode ? 'Updating…' : 'Creating…';
      return isEditMode ? 'Update Binding' : 'Create Binding';
    }
    return 'Next';
  })();

  const headerActions = (
    <Box className={classes.headerActions}>
      <Button onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={handleBack} disabled={isFirstStep || saving}>
        Back
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={isLastStep ? handleSubmit : handleNext}
        disabled={isLastStep ? saving : !canProceed}
      >
        {primaryActionLabel}
      </Button>
    </Box>
  );

  return (
    <DetailPageLayout
      title={title}
      subtitle={subtitleNode}
      onBack={onCancel}
      actions={headerActions}
    >
      <WizardStepper
        steps={activeSteps}
        currentStep={currentStep}
        currentIndex={currentIndex}
        state={wizardState}
        onStepClick={handleStepClick}
      />

      <Card className={classes.stepCard}>
        <CardContent className={classes.stepContent}>
          {renderStepContent()}
        </CardContent>
      </Card>

      {error && (
        <Typography variant="body2" className={classes.errorText}>
          {error}
        </Typography>
      )}
    </DetailPageLayout>
  );
};
