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
 */
export const EntityNamespaceProvider = ({
  children,
}: EntityNamespaceProviderProps) => {
  const { entity } = useEntity();
  const namespace =
    entity.metadata.annotations?.[NAMESPACE_ANNOTATION] ||
    entity.metadata.namespace ||
    '';

  return (
    <NamespaceProvider initialNamespace={namespace}>
      {children}
    </NamespaceProvider>
  );
};
