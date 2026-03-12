import { Stepper, Step, StepLabel, StepButton, Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  WizardStepId,
  WizardStepDef,
  WizardState,
  isStepClickable,
} from './types';

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
  },
  stepper: {
    padding: theme.spacing(2, 0, 0, 0),
  },
}));

interface WizardStepperProps {
  steps: WizardStepDef[];
  currentStep: WizardStepId;
  currentIndex: number;
  state: WizardState;
  onStepClick: (stepId: WizardStepId) => void;
}

export const WizardStepper = ({
  steps,
  currentStep,
  currentIndex,
  state,
  onStepClick,
}: WizardStepperProps) => {
  const classes = useStyles();

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
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
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
    </Box>
  );
};
