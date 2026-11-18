import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  NO_ENDPOINT,
  endpointTypeProtocols,
  protocolForEndpointType,
  exposableVisibilities,
  type EndpointExposureChoice,
  WorkloadEndpoint,
} from '@openchoreo/backstage-plugin-common';
import {
  EndpointList,
  endpointProtocolChanges,
  useEndpointEditBuffer,
} from '@openchoreo/backstage-plugin-react';
import { useWorkloadContext } from '../WorkloadContext';
import type { ComponentEndpointsState } from '../hooks/useComponentEndpoints';
import { endpointCards } from '../componentEndpointDrafts';
import {
  chosenEndpointTypeKeys,
  useEndpointTypeSchemas,
} from './EndpointExposure';
import { EndpointTypePicker } from './EndpointTypePicker';
import {
  ComponentEndpointExposure,
  ComponentEndpointTypeField,
  DetachedComponentEndpoints,
  cardEndpointType,
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
   * The component's own Endpoints and the form the tab shows, which its
   * ComponentType decides (see EndpointFormMode). Without it the tab shows
   * the legacy form.
   */
  componentEndpoints?: ComponentEndpointsState;
}

export const EndpointContent: FC<EndpointContentProps> = ({
  endpoints,
  onEndpointReplace,
  onAddEndpoint,
  onRemoveEndpoint,
  disabled: disabledProp,
  componentEndpoints,
}) => {
  // Until the ComponentType has been read, the tab doesn't know its form, so
  // its rows can't be edited.
  const disabled = disabledProp || !!componentEndpoints?.loadError;
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
  // A card with an Endpoint type needs a visibility beyond project for its
  // Endpoint to carry, so it can't be applied without one.
  const editingName = editBuffer.editingRow?.endpointName;
  const missingVisibility =
    !!endpointsForm &&
    !!editingName &&
    !!editBuffer.editBuffer &&
    cardEndpointType(editBuffer.editBuffer, endpointsForm, editingName) !==
      NO_ENDPOINT &&
    exposableVisibilities(editBuffer.editBuffer).length === 0;
  const listEditBuffer = useMemo(
    () =>
      formChoices && restoreChoice
        ? {
            ...editBuffer,
            isBufferValid: editBuffer.isBufferValid && !missingVisibility,
            startEdit: (name: string) => {
              editStart.current = { name, choice: formChoices[name] };
              editBuffer.startEdit(name);
            },
            // A new card has no choice to go back to.
            startNew: (name: string, initial?: WorkloadEndpoint) => {
              editStart.current = { name, choice: undefined };
              editBuffer.startNew(name, initial);
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
    [editBuffer, formChoices, restoreChoice, missingVisibility],
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

  // In the Endpoints form a card starts with how it's exposed: its Endpoint
  // type decides the protocols it can take, and only a card with a type
  // takes visibility beyond project, which its Endpoint carries.
  const updateBuffer = listEditBuffer.updateBuffer;
  const rowEditorProps = useCallback(
    (savedName: string, endpoint: WorkloadEndpoint, isEditing: boolean) => {
      if (!endpointsForm) return undefined;
      const typeKey = cardEndpointType(endpoint, endpointsForm, savedName);
      const exposed = typeKey !== NO_ENDPOINT;
      const protocols = exposed
        ? endpointTypeProtocols(typeKey, endpointsForm.allowedEndpoints)
        : [];
      return {
        header: isEditing ? (
          <ComponentEndpointTypeField
            workloadEndpoint={savedName}
            endpoint={endpoint}
            state={endpointsForm}
            onEndpointChange={updateBuffer}
            disabled={disabled}
          />
        ) : undefined,
        protocolOptions: protocols.length > 0 ? protocols : undefined,
        // A project-only card has no visibility to choose: picking an
        // Endpoint type under "Exposed as" is what takes it further.
        hideVisibility: !exposed,
        visibilityError:
          exposed && exposableVisibilities(endpoint).length === 0
            ? 'Select a visibility beyond Project for the Endpoint, or choose Project only.'
            : undefined,
      };
    },
    [endpointsForm, updateBuffer, disabled],
  );

  const setChoice = endpointsForm?.setChoice;

  // Adding an endpoint in the Endpoints form takes two steps: pick how it's
  // exposed, then fill in its card, which opens with that type and one of
  // the type's protocols.
  const [pickerOpen, setPickerOpen] = useState(false);
  const startNew = listEditBuffer.startNew;
  const handlePickType = useCallback(
    (typeKey: string) => {
      setPickerOpen(false);
      if (!allowedEndpoints || !setChoice) return;
      const name = onAddEndpoint();
      const exposed = typeKey !== NO_ENDPOINT;
      if (exposed) setChoice(name, { type: typeKey });
      const protocol = exposed
        ? protocolForEndpointType('HTTP', typeKey, allowedEndpoints)
        : 'HTTP';
      const base: WorkloadEndpoint = {
        type: 'HTTP',
        port: 8080,
        visibility: ['project'],
      };
      const initial = Object.fromEntries([
        ...Object.entries(base),
        ...endpointProtocolChanges(base, protocol),
      ]) as WorkloadEndpoint;
      startNew(name, initial);
    },
    [allowedEndpoints, setChoice, onAddEndpoint, startNew],
  );

  const deprecatedRows = endpointsForm?.deprecatedRows;
  const cards = useMemo(
    () => endpointCards(endpoints, endpointsForm?.mode, deprecatedRows),
    [endpoints, endpointsForm?.mode, deprecatedRows],
  );

  if (componentEndpoints?.mode === 'none' && !componentEndpoints.loadError) {
    return (
      <Typography variant="body2" color="textSecondary">
        This component type doesn't allow Endpoints, so its endpoints can't be
        configured here.
      </Typography>
    );
  }

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
      {Object.keys(endpointsForm ? cards : endpoints).length === 0 && (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          No endpoints.
        </Typography>
      )}
      {endpointsForm ? (
        <EndpointList
          endpoints={cards}
          disabled={disabled}
          editBuffer={listEditBuffer}
          onRemoveEndpoint={onRemoveEndpoint}
          onAddEndpoint={onAddEndpoint}
          onAddRequest={() => setPickerOpen(true)}
          hideAddButton={pickerOpen}
          rowEditorProps={rowEditorProps}
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
      {endpointsForm && (
        <EndpointTypePicker
          open={pickerOpen}
          allowedEndpoints={endpointsForm.allowedEndpoints}
          namespace={
            entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? ''
          }
          onSelect={handlePickType}
          onClose={() => setPickerOpen(false)}
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
