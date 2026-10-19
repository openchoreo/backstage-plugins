import { Entity } from '@backstage/catalog-model';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@material-ui/icons/Add';
import { SplitButton } from '@openchoreo/backstage-design-system';
import {
  useCreateComponentPath,
  useCreateEndpointPath,
  useCreateResourcePath,
  useEndpointCreatePermission,
  useScopedComponentCreatePermission,
  useResourceCreatePermission,
} from '@openchoreo/backstage-plugin-react';

/**
 * "Create" split button for the Project Contents table. The primary action
 * defaults to creating a Component; the dropdown switches to creating a
 * Resource or an Endpoint. Each kind is independently permission-gated.
 */
export const CreateProjectContentButton = ({ entity }: { entity: Entity }) => {
  const navigate = useNavigate();

  const { path: componentPath, loading: componentPathLoading } =
    useCreateComponentPath(entity);
  const { path: resourcePath, loading: resourcePathLoading } =
    useCreateResourcePath(entity);
  const { path: endpointPath, loading: endpointPathLoading } =
    useCreateEndpointPath(entity);

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
  const {
    canCreate: canCreateEndpoint,
    loading: endpointPermLoading,
    createDeniedTooltip: endpointDeniedTooltip,
  } = useEndpointCreatePermission();

  const loading =
    componentPathLoading ||
    resourcePathLoading ||
    endpointPathLoading ||
    componentPermLoading ||
    resourcePermLoading ||
    endpointPermLoading;
  const groupDisabled =
    !canCreateComponent && !canCreateResource && !canCreateEndpoint;

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
    {
      key: 'endpoint',
      label: 'Create Endpoint',
      icon: <AddIcon />,
      disabled: !canCreateEndpoint,
    },
  ];

  const handleClick = (key: string) => {
    if (key === 'component' && canCreateComponent) {
      navigate(componentPath);
    } else if (key === 'resource' && canCreateResource) {
      navigate(resourcePath);
    } else if (key === 'endpoint' && canCreateEndpoint) {
      navigate(endpointPath);
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
      minWidth={180}
      tooltip={
        groupDisabled
          ? componentDeniedTooltip ||
            resourceDeniedTooltip ||
            endpointDeniedTooltip
          : ''
      }
    />
  );
};
