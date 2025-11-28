import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  dialogContent: {
    minWidth: 400,
    paddingTop: theme.spacing(2),
  },
  helperText: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

interface BuildWithCommitDialogProps {
  open: boolean;
  onClose: () => void;
  onTrigger: (commit: string) => Promise<void>;
  isLoading?: boolean;
}

const validateCommitSha = (value: string): string | null => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null; // Empty is valid during typing
  }

  // Check for invalid characters
  if (!/^[a-f0-9]*$/i.test(trimmed)) {
    return 'Commit SHA must contain only hexadecimal characters (0-9, a-f)';
  }

  // Check length
  if (trimmed.length < 7) {
    return 'Commit SHA must be at least 7 characters long';
  }

  if (trimmed.length > 40) {
    return 'Commit SHA cannot exceed 40 characters';
  }

  return null; // Valid
};

export const BuildWithCommitDialog = ({
  open,
  onClose,
  onTrigger,
  isLoading = false,
}: BuildWithCommitDialogProps) => {
  const classes = useStyles();
  const [commitSha, setCommitSha] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    if (!isLoading) {
      setCommitSha('');
      setError('');
      onClose();
    }
  };

  const handleChange = (value: string) => {
    setCommitSha(value);

    const validationError = validateCommitSha(value);
    setError(validationError || '');
  };

//   const handleBlur = () => {
//     setTouched(true);
//     const validationError = validateCommitSha(commitSha);
//     setError(validationError || '');
//   };

  const handleTrigger = async () => {
    const trimmedCommit = commitSha.trim();

    if (!trimmedCommit) {
      setError('Commit SHA is required');
      return;
    }

    const validationError = validateCommitSha(trimmedCommit);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError('');
      await onTrigger(trimmedCommit);
      setCommitSha('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to trigger workflow',
      );
    }
  };

  const isValid = commitSha.trim() && !validateCommitSha(commitSha.trim());

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Build with Specific Commit</DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Typography variant="body2" className={classes.helperText}>
          Enter the commit SHA to build from a specific commit in your
          repository.
        </Typography>
        <TextField
          fullWidth
          label="Commit SHA"
          placeholder="e.g., abc123def456 or full 40-character SHA"
          value={commitSha}
          onChange={e => handleChange(e.target.value)}
          error={!!error}
          helperText={
            error ||
            'Enter a valid Git commit SHA (7-40 hexadecimal characters)'
          }
          disabled={isLoading}
          variant="outlined"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleTrigger}
          color="primary"
          variant="contained"
          disabled={isLoading || !isValid}
          startIcon={isLoading ? <CircularProgress size={16} /> : null}
        >
          {isLoading ? 'Triggering...' : 'Trigger Workflow'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
