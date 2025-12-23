import { FC, useEffect } from 'react';
import { WorkloadEndpoint } from '@openchoreo/backstage-plugin-common';
import {
  EndpointList,
  useEndpointEditBuffer,
} from '@openchoreo/backstage-plugin-react';
import { useWorkloadContext } from '../WorkloadContext';

interface EndpointContentProps {
  endpoints: { [key: string]: WorkloadEndpoint };
  onEndpointReplace: (endpointName: string, endpoint: WorkloadEndpoint) => void;
  onAddEndpoint: () => string;
  onRemoveEndpoint: (endpointName: string) => void;
  disabled: boolean;
}

export const EndpointContent: FC<EndpointContentProps> = ({
  endpoints,
  onEndpointReplace,
  onAddEndpoint,
  onRemoveEndpoint,
  disabled,
}) => {
  const { setEditingSection } = useWorkloadContext();

  const editBuffer = useEndpointEditBuffer({
    endpoints,
    onEndpointReplace,
    onRemoveEndpoint,
  });

  // Report editing state to context
  useEffect(() => {
    setEditingSection('endpoints', editBuffer.isAnyRowEditing);
  }, [editBuffer.isAnyRowEditing, setEditingSection]);

  return (
    <EndpointList
      endpoints={endpoints}
      disabled={disabled}
      editBuffer={editBuffer}
      onRemoveEndpoint={onRemoveEndpoint}
      onAddEndpoint={onAddEndpoint}
    />
  );
};
