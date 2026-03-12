import { ReactNode } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { NamespaceProvider } from '../../context';

const NAMESPACE_ANNOTATION = 'openchoreo.io/namespace';

interface EntityNamespaceProviderProps {
  children: ReactNode;
}

/**
 * Wraps children in a NamespaceProvider initialized from the entity's
 * `openchoreo.io/namespace` annotation. This allows all workflow hooks
 * (which read from NamespaceContext) to work within catalog entity pages.
 *
 * For cluster-scoped entity kinds (e.g. ClusterWorkflow), `entity.metadata.namespace`
 * is the Backstage catalog namespace (e.g. "openchoreo-cluster"), NOT the Kubernetes
 * workload namespace where WorkflowRun CRs are created. For those entities we fall
 * back to "default" unless the `openchoreo.io/namespace` annotation explicitly
 * specifies the target namespace.
 */

/** Entity kinds that are cluster-scoped; their Backstage namespace is not a K8s namespace. */
const CLUSTER_SCOPED_KINDS = new Set([
  'clusterworkflow',
  'clusterworkflowplane',
]);

export const EntityNamespaceProvider = ({
  children,
}: EntityNamespaceProviderProps) => {
  const { entity } = useEntity();

  const annotationNamespace =
    entity.metadata.annotations?.[NAMESPACE_ANNOTATION];

  const isClusterScoped = CLUSTER_SCOPED_KINDS.has(
    entity.kind?.toLowerCase() ?? '',
  );

  // Priority:
  // 1. Explicit openchoreo.io/namespace annotation (always wins)
  // 2. For namespace-scoped kinds: entity.metadata.namespace
  // 3. For cluster-scoped kinds: "default" (K8s default namespace for WorkflowRuns)
  // 4. Empty string fallback
  const namespace =
    annotationNamespace ||
    (isClusterScoped ? 'default' : entity.metadata.namespace) ||
    '';

  return (
    <NamespaceProvider initialNamespace={namespace}>
      {children}
    </NamespaceProvider>
  );
};
