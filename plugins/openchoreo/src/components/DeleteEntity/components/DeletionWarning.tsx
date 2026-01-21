import { useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { WarningPanel } from '@backstage/core-components';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/**
 * A warning banner that shows when a component is marked for deletion.
 * Fetches component details live from the backend to check for deletionTimestamp.
 * This handles the case where the catalog hasn't synced yet but the component
 * is already marked for deletion in the backend.
 */
export function DeletionWarning() {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const [isMarkedForDeletion, setIsMarkedForDeletion] = useState(false);
  const [deletionTimestamp, setDeletionTimestamp] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const entityKind = entity.kind.toLowerCase();
  const isComponent = entityKind === 'component';

  useEffect(() => {
    const checkDeletionStatus = async () => {
      // Only check for components
      if (!isComponent) {
        setLoading(false);
        return;
      }

      try {
        const componentDetails = await client.getComponentDetails(entity);
        if (componentDetails && 'deletionTimestamp' in componentDetails) {
          const timestamp = (componentDetails as { deletionTimestamp?: string })
            .deletionTimestamp;
          if (timestamp) {
            setIsMarkedForDeletion(true);
            setDeletionTimestamp(timestamp);
          }
        }
      } catch {
        // Silently fail - we don't want to show an error if the API call fails
        // The component might have already been deleted
      } finally {
        setLoading(false);
      }
    };

    checkDeletionStatus();
  }, [entity, client, isComponent]);

  // Don't show anything while loading or if not marked for deletion
  if (loading || !isMarkedForDeletion) {
    return null;
  }

  const formattedTimestamp = deletionTimestamp
    ? new Date(deletionTimestamp).toLocaleString()
    : 'Unknown';

  return (
    <WarningPanel
      severity="warning"
      title="This component is marked for deletion"
    >
      This component was marked for deletion on {formattedTimestamp}. It will be
      permanently removed soon. No further modifications are allowed.
    </WarningPanel>
  );
}
