import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
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
} from '../hooks';
import {
  WizardState,
  WizardStepId,
  WIZARD_STEPS,
  getStepIndex,
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

interface MappingDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (mapping: RoleEntitlementMapping) => Promise<void>;
  availableRoles: Role[];
  editingMapping?: RoleEntitlementMapping;
}

export const MappingDialog = ({
  open,
  onClose,
  onSave,
  availableRoles,
  editingMapping,
}: MappingDialogProps) => {
  const classes = useStyles();
  const { userTypes } = useUserTypes();

  const [currentStep, setCurrentStep] = useState<WizardStepId>('role');
  const [wizardState, setWizardState] = useState<WizardState>(() =>
    createInitialWizardState(userTypes),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editingMapping;

  // Initialize/reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep('role');
      setError(null);

      if (editingMapping) {
        // Populate from editing mapping
        const matchingUserType = userTypes.find(
          ut => getEntitlementClaim(ut) === editingMapping.entitlement.claim,
        );

        setWizardState({
          selectedRole: editingMapping.role_name,
          subjectType: matchingUserType?.type || userTypes[0]?.type || '',
          entitlementValue: editingMapping.entitlement.value,
          scopeType:
            editingMapping.hierarchy.organization ||
            editingMapping.hierarchy.project ||
            editingMapping.hierarchy.component
              ? 'specific'
              : 'global',
          organization: editingMapping.hierarchy.organization || '',
          orgUnits: editingMapping.hierarchy.organization_units || [],
          project: editingMapping.hierarchy.project || '',
          component: editingMapping.hierarchy.component || '',
          effect: editingMapping.effect,
        });
      } else {
        // Reset for new mapping
        setWizardState(createInitialWizardState(userTypes));
      }
    }
  }, [open, editingMapping, userTypes]);

  const handleStateChange = useCallback((updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleStepClick = (stepId: WizardStepId) => {
    setCurrentStep(stepId);
  };

  const handleNext = () => {
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(WIZARD_STEPS[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    // Validate all steps
    for (const step of WIZARD_STEPS) {
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

      const mapping: RoleEntitlementMapping = {
        role_name: wizardState.selectedRole,
        entitlement: {
          claim: entitlementClaim,
          value: wizardState.entitlementValue.trim(),
        },
        hierarchy:
          wizardState.scopeType === 'global'
            ? {}
            : {
                organization: wizardState.organization || undefined,
                organization_units:
                  wizardState.orgUnits.filter(u => u.trim()) || undefined,
                project: wizardState.project || undefined,
                component: wizardState.component || undefined,
              },
        effect: wizardState.effect,
      };

      await onSave(mapping);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mapping');
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
        return <RoleStep {...stepProps} />;
      case 'subject':
        return <SubjectStep {...stepProps} />;
      case 'scope':
        return <ScopeStep state={wizardState} onChange={handleStateChange} />;
      case 'effect':
        return <EffectStep state={wizardState} onChange={handleStateChange} />;
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
          {isEditMode ? 'Edit Role Mapping' : 'Create Role Mapping'}
        </Typography>
        <IconButton
          className={classes.closeButton}
          onClick={onClose}
          disabled={saving}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />

      <DialogContent className={classes.dialogContent}>
        <Box className={classes.stepContent}>{renderStepContent()}</Box>

        {error && (
          <Typography variant="body2" className={classes.errorText}>
            {error}
          </Typography>
        )}

        <WizardStepper
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
