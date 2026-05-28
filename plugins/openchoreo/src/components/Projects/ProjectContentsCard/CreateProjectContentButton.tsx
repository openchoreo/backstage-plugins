import { Entity } from '@backstage/catalog-model';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@material-ui/icons/Add';
import { SplitButton } from '@openchoreo/backstage-design-system';
import {
  useCreateComponentPath,
  useCreateResourcePath,
  useScopedComponentCreatePermission,
  useResourceCreatePermission,
} from '@openchoreo/backstage-plugin-react';

/**
 * "Create" split button for the Project Contents table. The primary action
 * defaults to creating a Component; the dropdown switches to creating a
 * Resource. Each kind is independently permission-gated.
 */
export const CreateProjectContentButton = ({ entity }: { entity: Entity }) => {
  const navigate = useNavigate();

  const { path: componentPath, loading: componentPathLoading } =
    useCreateComponentPath(entity);
  const { path: resourcePath, loading: resourcePathLoading } =
    useCreateResourcePath(entity);

  const {
    canCreate: canCreateComponent,
    loading: componentPermLoading,
    createDeniedTooltip: componentDeniedTooltip,
  } = useScopedComponentCreatePermission();
  const {
    canCreate: canCreateResource,
    loading: resourcePermLoading,
    createDeniedTooltip: resourceDeniedTooltip,
  } = useResourceCreatePermission();

  const loading =
    componentPathLoading ||
    resourcePathLoading ||
    componentPermLoading ||
    resourcePermLoading;
  const groupDisabled = !canCreateComponent && !canCreateResource;

  const options = [
    {
      key: 'component',
      label: 'Create Component',
      icon: <AddIcon />,
      disabled: !canCreateComponent,
    },
    {
      key: 'resource',
      label: 'Create Resource',
      icon: <AddIcon />,
      disabled: !canCreateResource,
    },
  ];

  const handleClick = (key: string) => {
    if (key === 'component' && canCreateComponent) {
      navigate(componentPath);
    } else if (key === 'resource' && canCreateResource) {
      navigate(resourcePath);
    }
  };

  return (
    <SplitButton
      options={options}
      onClick={handleClick}
      loading={loading}
      disabled={groupDisabled}
      variant="outlined"
      color="primary"
      size="small"
      tooltip={
        groupDisabled ? componentDeniedTooltip || resourceDeniedTooltip : ''
      }
    />
  );
};
