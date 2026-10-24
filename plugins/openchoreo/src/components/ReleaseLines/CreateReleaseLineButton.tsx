import Button from '@material-ui/core/Button';
import Tooltip from '@material-ui/core/Tooltip';
import AddIcon from '@material-ui/icons/Add';
import { useComponentUpdatePermission } from '@openchoreo/backstage-plugin-react';

export interface CreateReleaseLineButtonProps {
  onClick: () => void;
}

/** Opens the Create Release Line dialog; disabled without component update permission. */
export function CreateReleaseLineButton({
  onClick,
}: CreateReleaseLineButtonProps) {
  const { canUpdateComponent, loading } = useComponentUpdatePermission();

  return (
    <Tooltip
      title={
        canUpdateComponent || loading
          ? ''
          : 'You do not have permission to create release lines for this component'
      }
    >
      <span>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onClick}
          disabled={loading || !canUpdateComponent}
        >
          Create ReleaseLine
        </Button>
      </span>
    </Tooltip>
  );
}
