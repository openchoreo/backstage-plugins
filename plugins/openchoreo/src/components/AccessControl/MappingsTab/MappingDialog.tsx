import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { makeStyles } from '@material-ui/core/styles';
import {
  useUserTypes,
  getEntitlementClaim,
  ClusterRoleBinding,
  NamespaceRoleBinding,
  ClusterRole,
} from '../hooks';
import {
  ClusterRoleBindingRequest,
  NamespaceRoleBindingRequest,
} from '../../../api/OpenChoreoClientApi';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../constants';
import {
  WizardState,
  WizardStepId,
  WIZARD_STEPS,
  isStepValid,
  createInitialWizardState,
  WizardStepper,
  SubjectStep,
  RoleMappingsStep,
  EffectStep,
  ReviewStep,
} from './wizard';

const useStyles = makeStyles(theme => ({
  dialogTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 0,
  },
  closeButton: {
    marginRight: -theme.spacing(1),
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 0,
  },
  stepContent: {
    flex: 1,
    padding: theme.spacing(2, 0),
    minHeight: 0,
    overflowY: 'auto',
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
    padding: theme.spacing(0, 3),
  },
  dialogActions: {
    padding: theme.spacing(1, 3, 2, 3),
    borderTop: `1px solid ${theme.palette.divider}`,
    justifyContent: 'space-between',
  },
}));

export type BindingType = typeof SCOPE_CLUSTER | typeof SCOPE_NAMESPACE;

interface MappingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    binding: ClusterRoleBinding | NamespaceRoleBinding | any,
  ) => Promise<void>;
  availableRoles: ClusterRole[];
  editingBinding?: ClusterRoleBinding | NamespaceRoleBinding;
  bindingType?: BindingType;
  namespace?: string;
}

export const MappingDialog = ({
  open,
  onClose,
  onSave,
  availableRoles,
  editingBinding,
  bindingType,
  namespace,
}: MappingDialogProps) => {
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

  // Initialize/reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('subject');
      setError(null);

      if (editingBinding) {
        const matchingUserType = userTypes.find(
          ut => getEntitlementClaim(ut) === editingBinding.entitlement.claim,
        );

        if (bindingType === SCOPE_CLUSTER) {
          const clusterBinding = editingBinding as ClusterRoleBinding;
          setWizardState({
            subjectType: matchingUserType?.type || userTypes[0]?.type || '',
            entitlementValue: clusterBinding.entitlement.value,
            roleMappings: (clusterBinding.roleMappings || []).map(rm => ({
              role: rm.role,
              roleNamespace: '',
              namespace: rm.scope?.namespace || '',
              project: rm.scope?.project || '',
              component: rm.scope?.component || '',
              confirmed: true,
            })),
            effect: clusterBinding.effect,
            name: clusterBinding.name || '',
          });
        } else {
          const nsBinding = editingBinding as NamespaceRoleBinding;
          setWizardState({
            subjectType: matchingUserType?.type || userTypes[0]?.type || '',
            entitlementValue: nsBinding.entitlement.value,
            roleMappings: (nsBinding.roleMappings || []).map(rm => ({
              role: rm.role?.name || '',
              roleNamespace: rm.role?.namespace || '',
              namespace: '',
              project: rm.scope?.project || '',
              component: rm.scope?.component || '',
              confirmed: true,
            })),
            effect: nsBinding.effect,
            name: nsBinding.name || '',
          });
        }
      } else {
        setWizardState(createInitialWizardState(userTypes));
      }
    }
  }, [open, editingBinding, userTypes, bindingType]);

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

      const resolvedName = wizardState.name;

      if (bindingType === SCOPE_CLUSTER) {
        const binding: ClusterRoleBindingRequest = {
          name: resolvedName,
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
          })),
          entitlement: {
            claim: entitlementClaim,
            value: wizardState.entitlementValue.trim(),
          },
          effect: wizardState.effect,
        };
        await onSave(binding);
      } else if (bindingType === SCOPE_NAMESPACE) {
        const binding: NamespaceRoleBindingRequest = {
          name: resolvedName,
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: {
          minHeight: '80vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <Typography variant="h4">
          {isEditMode ? 'Edit' : 'Create'}{' '}
          {bindingType === SCOPE_CLUSTER
            ? 'Cluster Role Binding'
            : 'Namespace Role Binding'}
          {isEditMode && editingBinding && (
            <>
              : {editingBinding.name}
              {editingBinding.labels?.[CHOREO_LABELS.SYSTEM] === 'true' && (
                <Chip
                  label="System"
                  size="small"
                  variant="outlined"
                  style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    height: 20,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </>
          )}
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
        <WizardStepper
          steps={activeSteps}
          currentStep={currentStep}
          currentIndex={currentIndex}
          state={wizardState}
          onStepClick={handleStepClick}
        />

        <Box className={classes.stepContent}>{renderStepContent()}</Box>

        {error && (
          <Typography variant="body2" className={classes.errorText}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions className={classes.dialogActions}>
        <Button onClick={handleBack} disabled={isFirstStep || saving}>
          Back
        </Button>

        {isLastStep ? (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {(() => {
              if (saving) return isEditMode ? 'Updating...' : 'Creating...';
              return isEditMode ? 'Update Mapping' : 'Create Mapping';
            })()}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={!canProceed}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
