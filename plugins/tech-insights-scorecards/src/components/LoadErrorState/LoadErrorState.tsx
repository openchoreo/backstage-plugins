import Button from '@material-ui/core/Button';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';

interface LoadErrorStateProps {
  title: string;
  error: Error;
  onRetry: () => void;
}

export function LoadErrorState({ title, error, onRetry }: LoadErrorStateProps) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {error.message}
    </Alert>
  );
}
