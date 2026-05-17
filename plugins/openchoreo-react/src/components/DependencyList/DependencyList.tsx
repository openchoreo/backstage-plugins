import { useState, type FC } from 'react';
import { Box, Button, Menu, MenuItem, Typography } from '@material-ui/core';
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
import { ResourceDependencyEditor } from '../ResourceDependencyEditor';
import type { UseDependencyEditBufferResult } from '../../hooks/useDependencyEditBuffer';

const useStyles = makeStyles(theme => ({
  rowWrapper: {
    marginBottom: theme.spacing(1),
  },
  addButtonRow: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
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
 * Dependency list with inline editing support. Renders endpoint
 * dependencies via the buffered DependencyEditor (one row editable at a
 * time) and resource dependencies via the always-editable
 * ResourceDependencyEditor. Two `+ Add` buttons at the bottom let the
 * developer add either kind; the resource button opens a dropdown of
 * project-owned Resource entities not yet bound.
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
  const [resourceAnchor, setResourceAnchor] = useState<HTMLElement | null>(
    null,
  );

  const handleAddDependency = () => {
    const newIndex = onAddDependency();
    editBuffer.startNew(newIndex);
  };

  const handleRemoveDependency = (index: number) => {
    // If deleting the row being edited, clear edit state first
    if (editBuffer.isRowEditing(index)) {
      editBuffer.clearEditState();
    }
    onRemoveDependency(index);
  };

  const handleAddResourceDependency = (ref: string) => {
    setResourceAnchor(null);
    onAddResourceDependency?.(ref);
  };

  // Resources that exist in the catalog and aren't already bound. Empty
  // refs (a row that was just added but not yet pointed at a resource) are
  // ignored here so adding a placeholder doesn't block adding more rows.
  const wiredRefs = new Set(
    (resources ?? []).map(r => r.ref).filter(ref => !!ref),
  );
  const availableResources = projectResources.filter(
    e => !wiredRefs.has(e.metadata.name),
  );
  const canAddResource =
    !disabled &&
    !!onAddResourceDependency &&
    availableResources.length > 0;

  return (
    <Box>
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
              editDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
              deleteDisabled={editBuffer.isAnyRowEditing && !isCurrentlyEditing}
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

      {(resources ?? []).map((resource, index) => (
        <Box key={`resource-${index}`} className={classes.rowWrapper}>
          <ResourceDependencyEditor
            dependency={resource}
            outputs={outputsByRef[resource.ref] ?? []}
            disabled={disabled}
            onChange={updated =>
              onResourceDependencyReplace?.(index, updated)
            }
            onRemove={() => onRemoveResourceDependency?.(index)}
          />
        </Box>
      ))}

      <Box className={classes.addButtonRow}>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddDependency}
          variant="outlined"
          size="small"
          disabled={disabled || editBuffer.isAnyRowEditing}
          color="primary"
        >
          Add Component Dependency
        </Button>
        <Button
          startIcon={<AddIcon />}
          onClick={e => setResourceAnchor(e.currentTarget)}
          variant="outlined"
          size="small"
          disabled={!canAddResource}
          color="primary"
        >
          Add Resource Dependency
        </Button>
        <Menu
          anchorEl={resourceAnchor}
          open={Boolean(resourceAnchor)}
          onClose={() => setResourceAnchor(null)}
        >
          {availableResources.map(entity => (
            <MenuItem
              key={entity.metadata.name}
              onClick={() =>
                handleAddResourceDependency(entity.metadata.name)
              }
            >
              {entity.metadata.name}
              <Typography
                variant="caption"
                color="textSecondary"
                style={{ marginLeft: 8 }}
              >
                {entity.metadata.annotations?.[
                  'openchoreo.io/resource-type'
                ] || ''}
              </Typography>
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Box>
  );
};
