import { useEffect, useState } from 'react';
import { EmptyState, Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/**
 * Deploy empty state shown when a project's deployment pipeline has no
 * environments configured. Resolves the project's pipeline so users can
 * jump straight to its entity page to review/configure it, and
 * degrades to plain guidance if the pipeline can't be resolved.
 */
export const NoEnvironmentsEmptyState = () => {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const [pipelineUrl, setPipelineUrl] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const projectName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT] ??
      entity.metadata.name;
    const namespaceName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
    if (!projectName || !namespaceName) return undefined;

    client
      .fetchDeploymentPipeline(projectName, namespaceName)
      .then((pipeline: { name?: string }) => {
        if (cancelled || !pipeline?.name) return;
        const catalogNamespace = entity.metadata.namespace || 'default';
        setPipelineUrl(
          `/catalog/${catalogNamespace}/deploymentpipeline/${pipeline.name}`,
        );
      })
      .catch(() => {
        // Leave the link out if the pipeline ref can't be resolved.
      });

    return () => {
      cancelled = true;
    };
  }, [entity, client]);

  return (
    <EmptyState
      missing="content"
      title="No environments available to deploy"
      description={
        <>
          This project's deployment pipeline has no environments configured.{' '}
          {pipelineUrl ? (
            <>
              Review the <Link to={pipelineUrl}>pipeline configuration</Link> or
              contact your administrator.
            </>
          ) : (
            <>Contact your administrator to configure it.</>
          )}
        </>
      }
    />
  );
};
