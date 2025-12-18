import {
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Box,
  Button,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  WizardStepId,
  WizardState,
  WIZARD_STEPS,
  getStepIndex,
  isStepClickable,
  isStepValid,
} from './types';

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
  },
  stepper: {
    padding: theme.spacing(2, 0),
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  backButton: {
    marginRight: theme.spacing(1),
  },
}));

interface WizardStepperProps {
  currentStep: WizardStepId;
  state: WizardState;
  onStepClick: (stepId: WizardStepId) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  saving?: boolean;
  isEditMode?: boolean;
}

export const WizardStepper = ({
  currentStep,
  state,
  onStepClick,
  onNext,
  onBack,
  onSubmit,
  saving = false,
  isEditMode = false,
}: WizardStepperProps) => {
  const classes = useStyles();
  const currentIndex = getStepIndex(currentStep);
  const isLastStep = currentStep === 'review';
  const isFirstStep = currentStep === 'role';
  const canProceed = isStepValid(currentStep, state);

  const handleStepClick = (stepId: WizardStepId) => {
    if (isStepClickable(stepId, currentStep, state)) {
      onStepClick(stepId);
    }
  };

  return (
    <Box className={classes.root}>
      <Stepper
        activeStep={currentIndex}
        alternativeLabel
        className={classes.stepper}
      >
        {WIZARD_STEPS.map(step => {
          const stepIndex = getStepIndex(step.id);
          const isCompleted = stepIndex < currentIndex;
          const clickable = isStepClickable(step.id, currentStep, state);

          return (
            <Step key={step.id} completed={isCompleted}>
              <StepButton
                onClick={() => handleStepClick(step.id)}
                disabled={!clickable}
              >
                <StepLabel>{step.label}</StepLabel>
              </StepButton>
            </Step>
          );
        })}
      </Stepper>

      <Box className={classes.navigation}>
        <Button
          onClick={onBack}
          disabled={isFirstStep || saving}
          className={classes.backButton}
        >
          Back
        </Button>

        {isLastStep ? (
          <Button
            variant="contained"
            color="primary"
            onClick={onSubmit}
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
            onClick={onNext}
            disabled={!canProceed}
          >
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
};
