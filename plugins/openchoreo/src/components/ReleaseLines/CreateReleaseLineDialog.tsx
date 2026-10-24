import { useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import Alert from '@material-ui/lab/Alert';
import { getErrorMessage, isForbiddenError } from '../../utils/errorUtils';
import { validateReleaseLineName } from './releaseLineUtils';
import { useCreateReleaseLineDialogStyles } from './styles';

export interface CreateReleaseLineDialogProps {
  open: boolean;
  componentName: string;
  creating: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
}

/** Declares a new release line of a component: its name and an optional description. */
export function CreateReleaseLineDialog({
  open,
  componentName,
  creating,
  onClose,
  onCreate,
}: CreateReleaseLineDialogProps) {
  const classes = useCreateReleaseLineDialogStyles();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = touched ? validateReleaseLineName(name) : undefined;

  const reset = () => {
    setName('');
    setDescription('');
    setTouched(false);
    setError(null);
  };

  const handleClose = () => {
    if (creating) return;
    reset();
    onClose();
  };

  const handleCreate = async () => {
    setTouched(true);
    if (validateReleaseLineName(name)) return;

    try {
      await onCreate(name, description.trim() || undefined);
      reset();
      onClose();
    } catch (err) {
      setError(
        isForbiddenError(err)
          ? 'You do not have permission to create release lines for this component.'
          : getErrorMessage(err),
      );
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Release Line</DialogTitle>
      <DialogContent>
        <DialogContentText>
          A release line of {componentName} is built and deployed independently
          of its other lines, and starts with the component's configuration.
        </DialogContentText>
        {error && (
          <Alert
            severity="error"
            className={classes.field}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        <TextField
          id="release-line-name"
          className={classes.field}
          label="Name"
          value={name}
          onChange={event => setName(event.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={event => {
            if (event.key === 'Enter') handleCreate();
          }}
          error={Boolean(nameError)}
          helperText={
            nameError ?? 'Release line names are unique within a namespace.'
          }
          required
          fullWidth
          disabled={creating}
        />
        <TextField
          id="release-line-description"
          className={classes.field}
          label="Description"
          value={description}
          onChange={event => setDescription(event.target.value)}
          helperText="Optional. What this release line is for, e.g. the branch it builds."
          fullWidth
          disabled={creating}
        />
        <Alert severity="info">
          Overrides of the component's parameters, traits, build parameters and
          auto deploy are made once the release line is created, from within the
          release line.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          color="primary"
          variant="contained"
          disabled={creating}
        >
          {creating ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
