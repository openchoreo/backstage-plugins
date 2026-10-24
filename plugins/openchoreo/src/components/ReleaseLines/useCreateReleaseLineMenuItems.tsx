// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import type { Entity } from '@backstage/catalog-model';
import type { IconComponent } from '@backstage/core-plugin-api';
import { isOpenChoreoManagedOfKind } from '@openchoreo/backstage-plugin-common';
import { useComponentUpdatePermission } from '@openchoreo/backstage-plugin-react';
import { CreateReleaseLineDialog } from './CreateReleaseLineDialog';
import { componentEntityPath } from './releaseLineUtils';
import { useReleaseLines } from './useReleaseLines';

const isOpenChoreoComponent = isOpenChoreoManagedOfKind('component');

interface CreateReleaseLineMenuItem {
  title: string;
  Icon: IconComponent;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}

/**
 * The component context menu's Create Release Line item, offered on OpenChoreo
 * components. A created line opens the component's Overview, which then lists
 * its lines.
 */
export function useCreateReleaseLineMenuItems(entity: Entity): {
  extraMenuItems: CreateReleaseLineMenuItem[];
  CreateReleaseLineMenuDialog: FC;
} {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const managed = isOpenChoreoComponent(entity);
  const { canUpdateComponent, loading } = useComponentUpdatePermission();
  const { createReleaseLine, creating } = useReleaseLines(entity, {
    enabled: false,
  });

  const extraMenuItems = useMemo<CreateReleaseLineMenuItem[]>(() => {
    if (!managed || loading) return [];
    return [
      {
        title: 'Create Release Line',
        Icon: CallSplitIcon as IconComponent,
        onClick: () => setOpen(true),
        disabled: !canUpdateComponent,
        tooltip: canUpdateComponent
          ? undefined
          : 'You do not have permission to create release lines for this component',
      },
    ];
  }, [managed, loading, canUpdateComponent]);

  const handleCreate = useCallback(
    async (name: string, description?: string) => {
      await createReleaseLine(name, undefined, description);
      navigate(componentEntityPath(entity));
    },
    [createReleaseLine, navigate, entity],
  );

  const CreateReleaseLineMenuDialog: FC = useCallback(
    () => (
      <CreateReleaseLineDialog
        open={open}
        componentName={entity.metadata.title ?? entity.metadata.name}
        creating={creating}
        onClose={() => setOpen(false)}
        onCreate={handleCreate}
      />
    ),
    [open, entity, creating, handleCreate],
  );

  return { extraMenuItems, CreateReleaseLineMenuDialog };
}
