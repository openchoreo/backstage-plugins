import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { makeStyles } from '@material-ui/core/styles';
import {
  useUserTypes,
  getEntitlementClaim,
  Role,
  RoleEntitlementMapping,
  ClusterRoleBinding,
  NamespaceRoleBinding,
} from '../hooks';
import { ClusterRoleBindingRequest, NamespaceRoleBindingRequest } from '../../../api/OpenChoreoClientApi';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../constants';
import {
  WizardState,
  WizardStepId,
  WIZARD_STEPS,
  isStepValid,
  createInitialWizardState,
  WizardStepper,
  RoleStep,
  SubjectStep,
  ScopeStep,
  EffectStep,
  ReviewStep,
} from './wizard';

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing(1),
  },
  closeButton: {
    marginRight: -theme.spacing(1),
  },
  dialogContent: {
    minHeight: 500,
    display: 'flex',
    flexDirection: 'column',
  },
  stepContent: {
    flex: 1,
    padding: theme.spacing(2, 0),
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(2),
  },
}));

export type BindingType = 'mapping' | typeof SCOPE_CLUSTER | typeof SCOPE_NAMESPACE;

interface MappingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    mapping: RoleEntitlementMapping | ClusterRoleBinding | NamespaceRoleBinding | any,
  ) => Promise<void>;
  availableRoles: (Role & { isClusterRole?: boolean })[];
  editingMapping?: RoleEntitlementMapping;
  editingBinding?: ClusterRoleBinding | NamespaceRoleBinding;
  bindingType?: BindingType;
  namespace?: string;
}

export const MappingDialog = ({
  open,
  onClose,
  onSave,
  availableRoles,
  editingMapping,
  editingBinding,
  bindingType,
  namespace,
}: MappingDialogProps) => {
  const classes = useStyles();
  const { userTypes } = useUserTypes();

  const [currentStep, setCurrentStep] = useState<WizardStepId>('role');
  const [wizardState, setWizardState] = useState<WizardState>(() =>
    createInitialWizardState(userTypes),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editingMapping || !!editingBinding;

  // steps to include based on binding type
  const activeSteps = bindingType === SCOPE_CLUSTER
    ? WIZARD_STEPS.filter(s => s.id !== 'scope')
    : WIZARD_STEPS;

  // Initialize/reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('role');
      setError(null);

    if (editingBinding) {
        const matchingUserType = userTypes.find(
          ut => getEntitlementClaim(ut) === editingBinding.entitlement.claim,
        );

        // Base fields shared by both cluster and namespace bindings
        const baseState = {
          selectedRole: editingBinding.role.name,
          selectedRoleNamespace: '',
          subjectType: matchingUserType?.type || userTypes[0]?.type || '',
          entitlementValue: editingBinding.entitlement.value,
          scopeType: 'global' as const,
          namespace: '',
          namespaceUnits: [] as string[],
          project: '',
          component: '',
          effect: editingBinding.effect,
          name: editingBinding.name || '',
        };

        if (bindingType === SCOPE_NAMESPACE) {
          const nsBinding = editingBinding as NamespaceRoleBinding;
          setWizardState({
            ...baseState,
            selectedRoleNamespace: nsBinding.role?.namespace || '',
            scopeType: nsBinding.hierarchy?.project ? 'specific' : 'global',
            project: nsBinding.hierarchy?.project || '',
          });
        } else {
          // Cluster binding — no namespace or scope fields needed
          setWizardState(baseState);
        }
      } else {
        // Reset for new mapping/binding
        setWizardState(createInitialWizardState(userTypes));
      }
    }
  }, [open, editingMapping, editingBinding, userTypes, bindingType]);

  const handleStateChange = useCallback((updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleStepClick = (stepId: WizardStepId) => {
    setCurrentStep(stepId);
  };

  const handleNext = () => {
    const currentIndex = activeSteps.findIndex(s => s.id === currentStep);
    if (currentIndex < activeSteps.length - 1) {
      setCurrentStep(activeSteps[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = activeSteps.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(activeSteps[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    for (const step of activeSteps) {
      if (!isStepValid(step.id, wizardState)) {
        setError(`Please complete the ${step.label} step`);
        setCurrentStep(step.id);
        return;
      }
    }

    // Get entitlement claim from user type
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

      const resolvedName = wizardState.name ||
        `${wizardState.selectedRole}-${wizardState.entitlementValue.trim()}`.toLowerCase();

      if (bindingType === SCOPE_CLUSTER) {
        // Create cluster role binding
        const binding: ClusterRoleBindingRequest = {
          name: resolvedName,
          role: wizardState.selectedRole,
          entitlement: {
            claim: entitlementClaim,
            value: wizardState.entitlementValue.trim(),
          },
          effect: wizardState.effect,
        };
        await onSave(binding);
      } else if (bindingType === SCOPE_NAMESPACE) {
        // Create namespace role binding request
        const binding: NamespaceRoleBindingRequest = {
          name: resolvedName,
          role: {
            name: wizardState.selectedRole,
            namespace: wizardState.selectedRoleNamespace,
          },
          entitlement: {
            claim: entitlementClaim,
            value: wizardState.entitlementValue.trim(),
          },
          ...(wizardState.scopeType === 'specific' && wizardState.project && {
            targetPath: { project: wizardState.project },
          }),
          effect: wizardState.effect,
        };
        await onSave(binding);
      } else {
        // Create role entitlement mapping (original behavior)
        const mapping: RoleEntitlementMapping = {
          role: { name: wizardState.selectedRole },
          entitlement: {
            claim: entitlementClaim,
            value: wizardState.entitlementValue.trim(),
          },
          hierarchy:
            wizardState.scopeType === 'global'
              ? {}
              : {
                  namespace: wizardState.namespace || undefined,
                  project: wizardState.project || undefined,
                  component: wizardState.component || undefined,
                },
          effect: wizardState.effect,
        };
        await onSave(mapping);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
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
      case 'role':
        return <RoleStep {...stepProps} bindingType={bindingType} />;
      case 'subject':
        return <SubjectStep {...stepProps} />;
      case 'scope':
        return (
          <ScopeStep
            state={wizardState}
            onChange={handleStateChange}
            bindingType={bindingType}
            namespace={namespace}
          />
        );
      case 'effect':
        return <EffectStep state={wizardState} onChange={handleStateChange} isEditMode={isEditMode} />;
      case 'review':
        return <ReviewStep {...stepProps} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <Typography variant="h4">
          {(() => {
            let typeLabel = 'Role Mapping';
            if (bindingType === SCOPE_CLUSTER) {
              typeLabel = 'Cluster Role Binding';
            } else if (bindingType === SCOPE_NAMESPACE) {
              typeLabel = 'Namespace Role Binding';
            }
            return isEditMode ? `Edit ${typeLabel}` : `Create ${typeLabel}`;
          })()}
        </Typography>
        <IconButton
          className={classes.closeButton}
          onClick={onClose}
          disabled={saving}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Box className={classes.stepContent}>{renderStepContent()}</Box>

        {error && (
          <Typography variant="body2" className={classes.errorText}>
            {error}
          </Typography>
        )}

        <WizardStepper
          steps={activeSteps}
          currentStep={currentStep}
          state={wizardState}
          onStepClick={handleStepClick}
          onNext={handleNext}
          onBack={handleBack}
          onSubmit={handleSubmit}
          saving={saving}
          isEditMode={isEditMode}
        />
      </DialogContent>
    </Dialog>
  );
};
