import { useRef } from 'react';
import { Box } from '@material-ui/core';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE, BindingScope } from '../constants';
import { ScopeDropdown } from '../ScopeDropdown';
import { ClusterRoleBindingsContent } from './ClusterRoleBindingsContent';
import { NamespaceRoleBindingsContent } from './NamespaceRoleBindingsContent';
import { NamespaceSelector } from '../RolesTab/NamespaceSelector';
import { useNamespaces } from '../hooks';
import { useQueryParams } from '../../../hooks/useQueryParams';

export const MappingsTab = () => {
  const [params, setParams] = useQueryParams({
    namespace: { defaultValue: '' },
    action: { defaultValue: '' },
    bindingName: { defaultValue: '' },
  });
  const selectedNamespace = (params.namespace as string) || '';
  // Presence of ?namespace=... implies namespace scope; absence means cluster.
  const scope: BindingScope = selectedNamespace
    ? SCOPE_NAMESPACE
    : SCOPE_CLUSTER;
  const { namespaces, loading: namespacesLoading } = useNamespaces();

  const setScope = (value: BindingScope) => {
    if (value === SCOPE_NAMESPACE) {
      setParams({ namespace: namespaces[0]?.name || '' });
    } else {
      setParams({ namespace: '' });
    }
  };
  const setSelectedNamespace = (value: string) =>
    setParams({ namespace: value });
  const rawAction = (params.action as string) || '';
  const action: '' | 'create' | 'edit' =
    rawAction === 'create' || rawAction === 'edit' ? rawAction : '';
  const bindingName = (params.bindingName as string) || '';
  const wizardActive = action === 'create' || action === 'edit';

  const actionsRef = useRef<HTMLDivElement>(null);

  return (
    <Box>
      {!wizardActive && (
        <Box
          display="flex"
          alignItems="center"
          style={{ gap: 16, marginBottom: 16 }}
        >
          <ScopeDropdown
            value={scope}
            onChange={setScope}
            clusterLabel="Cluster Role Bindings"
            namespaceLabel="Namespace Role Bindings"
            disabled={namespacesLoading}
          />
          {scope === SCOPE_NAMESPACE && (
            <NamespaceSelector
              value={selectedNamespace}
              onChange={setSelectedNamespace}
              disabled={namespacesLoading}
            />
          )}
          <Box flexGrow={1} />
          <div
            ref={actionsRef}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          />
        </Box>
      )}
      {scope === SCOPE_CLUSTER && (
        <ClusterRoleBindingsContent
          actionsContainerRef={actionsRef}
          wizardAction={action}
          wizardBindingName={bindingName}
        />
      )}
      {scope === SCOPE_NAMESPACE && (
        <NamespaceRoleBindingsContent
          selectedNamespace={selectedNamespace}
          actionsContainerRef={actionsRef}
          wizardAction={action}
          wizardBindingName={bindingName}
        />
      )}
    </Box>
  );
};
