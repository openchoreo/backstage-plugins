import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { CheckForm } from './CheckForm';
import type { DynamicCheck, FactSchema } from '../../api/types';

interface CheckFormDialogProps {
  open: boolean;
  check: DynamicCheck | null;
  factSchemas: FactSchema[];
  existingCategories: string[];
  onClose: () => void;
  onSaved: (check: DynamicCheck) => void;
  onPublished: () => void;
}

/**
 * Modal wrapper around `CheckForm` for table-style callers (CheckPolicyTable)
 * that trigger create/edit via a "New check"/edit action rather than an
 * inline side-panel. `CheckForm` keeps its own title/InfoCard chrome, so this
 * only adds a close button, not a second title.
 */
export function CheckFormDialog(props: CheckFormDialogProps) {
  const {
    open,
    check,
    factSchemas,
    existingCategories,
    onClose,
    onSaved,
    onPublished,
  } = props;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
    >
      <IconButton
        onClick={onClose}
        size="small"
        aria-label="Close"
        style={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent style={{ paddingTop: 24 }}>
        <CheckForm
          key={check?.id ?? 'new'}
          check={check}
          factSchemas={factSchemas}
          existingCategories={existingCategories}
          onSaved={onSaved}
          onPublished={onPublished}
        />
      </DialogContent>
    </Dialog>
  );
}
