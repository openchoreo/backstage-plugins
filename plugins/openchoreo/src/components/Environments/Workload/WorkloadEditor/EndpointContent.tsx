import { FC, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  endpointProtocol,
  type EndpointExposureChoice,
  endpointTypeCandidates,
  WorkloadEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  EndpointList,
  useEndpointEditBuffer,
} from '@openchoreo/backstage-plugin-react';
import { useWorkloadContext } from '../WorkloadContext';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import {
  chosenEndpointTypeKeys,
  useEndpointTypeSchemas,
} from './EndpointExposure';
import {
  ComponentEndpointExposure,
  DetachedComponentEndpoints,
} from './ComponentEndpointExposure';

const NO_KEYS: string[] = [];

interface EndpointContentProps {
  endpoints: { [key: string]: WorkloadEndpoint };
  onEndpointReplace: (
    endpointName: string,
    endpoint: WorkloadEndpoint,
    oldNameToRemove?: string,
  ) => void;
  onAddEndpoint: () => string;
  onRemoveEndpoint: (endpointName: string) => void;
  disabled: boolean;
  /**
   * The component's own Endpoints and the form the tab shows: the Endpoints
   * form exposes each row through an Endpoint, the legacy form keeps
   * visibility on the workload. Without it the tab shows the legacy form.
   */
  componentEndpoints?: ComponentEndpointsState;
}

/**
 * The banner on top of the tab: what the current form does, and the way to
 * the other one. The Endpoints form always offers legacy endpoints, for
 * components that still rely on the ComponentType's templated routes. The legacy
 * form asks to migrate, which needs an Endpoint type to migrate to.
 */
const FormBanner = ({
  state,
  disabled,
}: {
  state?: ComponentEndpointsState;
  disabled: boolean;
}) => {
  const switchButton = (to: 'endpoints' | 'legacy', label: string) =>
    state && (
      <Button
        color="inherit"
        size="small"
        disabled={disabled}
        onClick={() => state.setMode(to)}
      >
        {label}
      </Button>
    );

  if (state?.mode === 'endpoints') {
    return (
      <Alert severity="info" action={switchButton('legacy', 'Switch')}>
        {state.canUseEndpoints
          ? 'If this component still uses the ComponentType templated routes, switch to legacy endpoints.'
          : 'This component type allows no Endpoint types, so endpoints are reachable within the project only. If this component still uses the ComponentType templated routes, switch to legacy endpoints.'}
      </Alert>
    );
  }

  // Migrating needs an Endpoint type; switching back is always possible for
  // a page that opened in the Endpoints form.
  let action: ReactNode = null;
  if (state?.canUseEndpoints) {
    action = switchButton('endpoints', 'Migrate');
  } else if (state?.initialMode === 'endpoints') {
    action = switchButton('endpoints', 'Switch to Endpoints');
  }
  return (
    <Alert severity="warning" action={action}>
      The Visibility and Type fields of the Workload are deprecated in favour of
      the new Endpoint implementation.{' '}
      {state?.canUseEndpoints
        ? 'Migrate to Endpoints for continued support.'
        : 'To migrate to Endpoints for continued support, a platform engineer must allow Endpoint types on this component type.'}
    </Alert>
  );
};

export const EndpointContent: FC<EndpointContentProps> = ({
  endpoints,
  onEndpointReplace,
  onAddEndpoint,
  onRemoveEndpoint,
  disabled,
  componentEndpoints,
}) => {
  const { setEditingSection } = useWorkloadContext();
  const { entity } = useEntity();

  // A renamed workload endpoint keeps its Endpoints.
  const renameWorkloadEndpoint = componentEndpoints?.renameWorkloadEndpoint;
  const handleEndpointReplace = useCallback(
    (
      endpointName: string,
      endpoint: WorkloadEndpoint,
      oldNameToRemove?: string,
    ) => {
      if (oldNameToRemove && oldNameToRemove !== endpointName) {
        renameWorkloadEndpoint?.(oldNameToRemove, endpointName);
      }
      onEndpointReplace(endpointName, endpoint, oldNameToRemove);
    },
    [onEndpointReplace, renameWorkloadEndpoint],
  );

  const editBuffer = useEndpointEditBuffer({
    endpoints,
    onEndpointReplace: handleEndpointReplace,
    onRemoveEndpoint,
  });

  // Report editing state to context
  useEffect(() => {
    setEditingSection('endpoints', editBuffer.isAnyRowEditing);
  }, [editBuffer.isAnyRowEditing, setEditingSection]);

  const endpointsForm =
    componentEndpoints?.mode === 'endpoints' ? componentEndpoints : undefined;

  // A row's type and parameters are edited with the row, so cancelling the
  // edit puts back the choice the row had when editing started.
  const editStart = useRef<{
    name: string;
    choice: EndpointExposureChoice | undefined;
  } | null>(null);
  const formChoices = endpointsForm?.choices;
  const restoreChoice = endpointsForm?.restoreChoice;
  const listEditBuffer = useMemo(
    () =>
      formChoices && restoreChoice
        ? {
            ...editBuffer,
            startEdit: (name: string) => {
              editStart.current = { name, choice: formChoices[name] };
              editBuffer.startEdit(name);
            },
            applyEdit: () => {
              editStart.current = null;
              editBuffer.applyEdit();
            },
            cancelEdit: () => {
              const start = editStart.current;
              editStart.current = null;
              if (start) restoreChoice(start.name, start.choice);
              editBuffer.cancelEdit();
            },
          }
        : editBuffer,
    [editBuffer, formChoices, restoreChoice],
  );
  const choices = endpointsForm?.choices;
  const allowedEndpoints = endpointsForm?.allowedEndpoints;
  const typeKeys = useMemo(
    () =>
      allowedEndpoints && choices
        ? chosenEndpointTypeKeys(endpoints, allowedEndpoints, choices)
        : NO_KEYS,
    [endpoints, allowedEndpoints, choices],
  );
  const schemas = useEndpointTypeSchemas(
    typeKeys,
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '',
  );

  // In the Endpoints form, visibility beyond project needs an Endpoint, so
  // a protocol no allowed type serves stays project-scoped.
  const visibilityDisabledReason = useCallback(
    (endpoint: WorkloadEndpoint) => {
      if (!allowedEndpoints) return undefined;
      if (allowedEndpoints.length === 0) {
        return 'This component type allows no Endpoint types, so this endpoint stays project-scoped.';
      }
      const protocol = endpointProtocol(endpoint);
      return endpointTypeCandidates(protocol, allowedEndpoints).length === 0
        ? `No endpoint type is allowed for ${
            protocol || 'this protocol'
          }, so this endpoint stays project-scoped.`
        : undefined;
    },
    [allowedEndpoints],
  );

  return (
    <>
      {componentEndpoints?.loadError && (
        <Typography variant="body2" color="error" gutterBottom>
          Could not load the component's Endpoints:{' '}
          {componentEndpoints.loadError}
        </Typography>
      )}
      {componentEndpoints?.mode === 'endpoints' &&
        componentEndpoints.draftedFromMain > 0 && (
          <Box mb={2}>
            <Alert severity="info">
              This release line has no Endpoints yet, so the endpoints are
              prefilled from the main line's Endpoints. Review each one's
              Endpoint type and parameters, such as its path, before saving:
              saving creates these Endpoints for this release line.
            </Alert>
          </Box>
        )}
      <Box mb={2}>
        <FormBanner state={componentEndpoints} disabled={disabled} />
      </Box>
      {Object.keys(endpoints).length === 0 && (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          No endpoints.
        </Typography>
      )}
      {endpointsForm ? (
        <EndpointList
          endpoints={endpoints}
          disabled={disabled}
          editBuffer={listEditBuffer}
          onRemoveEndpoint={onRemoveEndpoint}
          onAddEndpoint={onAddEndpoint}
          visibilityDisabledReason={visibilityDisabledReason}
          renderDetails={(_name, endpoint, savedName, isEditing) => (
            <ComponentEndpointExposure
              workloadEndpoint={savedName}
              endpoint={endpoint}
              state={endpointsForm}
              schemas={schemas}
              disabled={disabled}
              editing={isEditing}
            />
          )}
        />
      ) : (
        <EndpointList
          endpoints={endpoints}
          disabled={disabled}
          editBuffer={editBuffer}
          onRemoveEndpoint={onRemoveEndpoint}
          onAddEndpoint={onAddEndpoint}
        />
      )}
      {componentEndpoints && (
        <DetachedComponentEndpoints
          workloadEndpoints={endpoints}
          state={componentEndpoints}
        />
      )}
    </>
  );
};
