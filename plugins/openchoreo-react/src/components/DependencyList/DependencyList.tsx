import { useMemo, type FC } from 'react';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import type { Entity } from '@backstage/catalog-model';
import type {
  Dependency,
  ResourceDependency,
  ResourceTypeOutput,
} from '@openchoreo/backstage-plugin-common';
import {
  DependencyEditor,
  type ProjectOption,
  type ComponentOption,
  type EndpointOption,
} from '../DependencyEditor';
import {
  ResourceDependencyEditor,
  type ResourceOption,
} from '../ResourceDependencyEditor';
import type { UseDependencyEditBufferResult } from '../../hooks/useDependencyEditBuffer';
import { useResourceDependencyEditBuffer } from '../../hooks/useResourceDependencyEditBuffer';

const useStyles = makeStyles(theme => ({
  rowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButtonRow: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
}));

export interface DependencyListProps {
  /** Endpoint dependencies to display and edit */
  dependencies: Dependency[];
  /** Resource dependencies edited via the inline ResourceDependencyEditor. */
  resources?: ResourceDependency[];
  /** Whether editing is disabled */
  disabled: boolean;
  /** Edit buffer state and handlers from useDependencyEditBuffer */
  editBuffer: UseDependencyEditBufferResult;
  /** Callback when dependency should be removed */
  onRemoveDependency: (index: number) => void;
  /** Callback to add new dependency (returns the new index) */
  onAddDependency: () => number;
  /** Callback to get projects for a dependency */
  getProjects: (index: number) => ProjectOption[];
  /** Callback to get components for a dependency */
  getComponents: (index: number) => ComponentOption[];
  /** Callback to get endpoints for a dependency */
  getEndpoints: (index: number) => EndpointOption[];
  /** Callback when project changes */
  onProjectChange: (index: number, projectName: string) => void;
  /** Callback when component changes */
  onComponentChange: (index: number, componentName: string) => void;
  /** Callback when endpoint changes */
  onEndpointChange: (index: number, endpoint: string) => void;
  /** Callback to get available visibility options for a dependency */
  getAvailableVisibilities: (index: number) => ('project' | 'namespace')[];
  /** Catalog Resource entities the developer can pick from when adding a
   * resource dependency. Filtered to the current project by the caller. */
  projectResources?: Entity[];
  /** Outputs schema keyed by resource ref. Passed to each editor row so
   * the Add-binding dropdown and per-row kind chips have data. */
  outputsByRef?: Record<string, ResourceTypeOutput[]>;
  /** Replace a resource dependency at an index. */
  onResourceDependencyReplace?: (
    index: number,
    resource: ResourceDependency,
  ) => void;
  /** Add a new resource dependency for the given ref. Returns its index. */
  onAddResourceDependency?: (ref: string) => number;
  /** Remove the resource dependency at an index. */
  onRemoveResourceDependency?: (index: number) => void;
}

/**
 * Dependency list with inline editing for endpoint and resource deps.
 * Each row uses the collapsed-summary / expanded-form pattern: only one
 * row across either type can be in edit mode at a time, and the two
 * `+ Add` buttons disable while any row is editing.
 */
export const DependencyList: FC<DependencyListProps> = ({
  dependencies,
  resources,
  disabled,
  editBuffer,
  onRemoveDependency,
  onAddDependency,
  getProjects,
  getComponents,
  getEndpoints,
  onProjectChange,
  onComponentChange,
  onEndpointChange,
  getAvailableVisibilities,
  projectResources = [],
  outputsByRef = {},
  onResourceDependencyReplace,
  onAddResourceDependency,
  onRemoveResourceDependency,
}) => {
  const classes = useStyles();

  // Resource-side edit buffer, mirroring the endpoint side. Both buffers
  // gate the Add buttons via `isAnyRowEditing`.
  const resourceEditBuffer = useResourceDependencyEditBuffer({
    resources: resources ?? [],
    onResourceDependencyReplace,
    onRemoveResourceDependency:
      onRemoveResourceDependency ?? (() => {}),
  });

  const anyRowEditing =
    editBuffer.isAnyRowEditing || resourceEditBuffer.isAnyRowEditing;

  const handleAddDependency = () => {
    const newIndex = onAddDependency();
    editBuffer.startNew(newIndex);
  };

  const handleRemoveDependency = (index: number) => {
    if (editBuffer.isRowEditing(index)) {
      editBuffer.clearEditState();
    }
    onRemoveDependency(index);
  };

  const handleAddResourceDependency = () => {
    if (!onAddResourceDependency) return;
    // Add an empty placeholder; the editor's in-row Resource Select fills
    // in the ref. Mirrors the endpoint flow where an empty row is added
    // and the user picks Project / Component / Endpoint inside the form.
    const newIndex = onAddResourceDependency('');
    resourceEditBuffer.startNew(newIndex);
  };

  const handleRemoveResourceDependency = (index: number) => {
    if (resourceEditBuffer.isRowEditing(index)) {
      resourceEditBuffer.clearEditState();
    }
    onRemoveResourceDependency?.(index);
  };

  // Project resources mapped to the option shape consumed by the editor's
  // in-row Select. The editor handles its own filtering for the active
  // row's current ref so users can still see their own picked resource.
  const projectResourceOptions: ResourceOption[] = useMemo(
    () =>
      projectResources.map(e => ({
        name: e.metadata.name,
        resourceType:
          e.metadata.annotations?.['openchoreo.io/resource-type'] || undefined,
      })),
    [projectResources],
  );

  const canAddResource =
    !disabled &&
    !anyRowEditing &&
    !!onAddResourceDependency &&
    projectResources.length > 0;

  return (
    <Box>
      <Box className={classes.addButtonRow}>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddDependency}
          variant="outlined"
          size="small"
          disabled={disabled || anyRowEditing}
          color="primary"
        >
          Add Component Dependency
        </Button>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddResourceDependency}
          variant="outlined"
          size="small"
          disabled={!canAddResource}
          color="primary"
        >
          Add Resource Dependency
        </Button>
      </Box>

      {dependencies.map((dependency, index) => {
        const isCurrentlyEditing = editBuffer.isRowEditing(index);
        const effectiveDependency =
          isCurrentlyEditing && editBuffer.editBuffer
            ? editBuffer.editBuffer
            : dependency;

        return (
          <Box key={index} className={classes.rowWrapper}>
            <DependencyEditor
              index={index}
              dependency={effectiveDependency}
              disabled={disabled}
              isEditing={isCurrentlyEditing}
              onEdit={() => editBuffer.startEdit(index)}
              onApply={editBuffer.applyEdit}
              onCancel={editBuffer.cancelEdit}
              editDisabled={anyRowEditing && !isCurrentlyEditing}
              deleteDisabled={anyRowEditing && !isCurrentlyEditing}
              applyDisabled={isCurrentlyEditing && !editBuffer.isBufferValid}
              projects={getProjects(index)}
              components={getComponents(index)}
              endpoints={getEndpoints(index)}
              onProjectChange={projectName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('project', projectName);
                  editBuffer.updateBuffer('component', '');
                  editBuffer.updateBuffer('name', '');
                  editBuffer.updateBuffer('visibility', '');
                }
                onProjectChange(index, projectName);
              }}
              onComponentChange={componentName => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('component', componentName);
                  editBuffer.updateBuffer('name', '');
                  editBuffer.updateBuffer('visibility', '');
                }
                onComponentChange(index, componentName);
              }}
              onEndpointChange={endpoint => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('name', endpoint);
                  // Reset visibility since available options may change
                  editBuffer.updateBuffer('visibility', '');
                }
                onEndpointChange(index, endpoint);
              }}
              availableVisibilities={getAvailableVisibilities(index)}
              onVisibilityChange={visibility => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBuffer('visibility', visibility);
                }
              }}
              onEnvBindingChange={(field, value) => {
                if (isCurrentlyEditing) {
                  editBuffer.updateBufferEnvBindings(field, value);
                }
              }}
              onRemove={() => handleRemoveDependency(index)}
            />
          </Box>
        );
      })}

      {(resources ?? []).map((resource, index) => {
        const isCurrentlyEditing = resourceEditBuffer.isRowEditing(index);
        const effectiveResource =
          isCurrentlyEditing && resourceEditBuffer.editBuffer
            ? resourceEditBuffer.editBuffer
            : resource;
        // Each row's picker shows project resources minus those already
        // claimed by OTHER rows. The active row's saved ref stays
        // selectable so the user can keep their current pick.
        const otherWiredRefs = new Set(
          (resources ?? [])
            .filter((_, i) => i !== index)
            .map(r => r.ref)
            .filter(ref => !!ref),
        );
        const availableForRow = projectResourceOptions.filter(
          o => !otherWiredRefs.has(o.name),
        );
        return (
          <Box key={`resource-${index}`} className={classes.rowWrapper}>
            <ResourceDependencyEditor
              dependency={effectiveResource}
              outputs={outputsByRef[effectiveResource.ref] ?? []}
              availableResources={availableForRow}
              disabled={disabled}
              isEditing={isCurrentlyEditing}
              onEdit={() => resourceEditBuffer.startEdit(index)}
              onApply={resourceEditBuffer.applyEdit}
              onCancel={resourceEditBuffer.cancelEdit}
              editDisabled={anyRowEditing && !isCurrentlyEditing}
              deleteDisabled={anyRowEditing && !isCurrentlyEditing}
              applyDisabled={
                isCurrentlyEditing && !resourceEditBuffer.isBufferValid
              }
              onChange={updated => {
                if (isCurrentlyEditing) {
                  resourceEditBuffer.setBuffer(updated);
                }
              }}
              onRemove={() => handleRemoveResourceDependency(index)}
            />
          </Box>
        );
      })}
    </Box>
  );
};
