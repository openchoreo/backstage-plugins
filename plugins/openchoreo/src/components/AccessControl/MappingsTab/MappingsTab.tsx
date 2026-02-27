import { useState, useRef } from 'react';
import { Box } from '@material-ui/core';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE, BindingScope } from '../constants';
import { ScopeDropdown } from '../ScopeDropdown';
import { ClusterRoleBindingsContent } from './ClusterRoleBindingsContent';
import { NamespaceRoleBindingsContent } from './NamespaceRoleBindingsContent';
import { NamespaceSelector } from '../RolesTab/NamespaceSelector';
import { useQueryParams } from '../../../hooks/useQueryParams';

export const MappingsTab = () => {
  const [params, setParams] = useQueryParams({
    scope: { defaultValue: SCOPE_CLUSTER },
  });
  const scope = (params.scope as BindingScope) ?? SCOPE_CLUSTER;
  const setScope = (value: BindingScope) => setParams({ scope: value });
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const actionsRef = useRef<HTMLDivElement>(null);

  return (
    <Box>
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
        />
        {scope === SCOPE_NAMESPACE && (
          <NamespaceSelector
            value={selectedNamespace}
            onChange={setSelectedNamespace}
          />
        )}
        <Box flexGrow={1} />
        <div
          ref={actionsRef}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        />
      </Box>
      {scope === SCOPE_CLUSTER && (
        <ClusterRoleBindingsContent actionsContainerRef={actionsRef} />
      )}
      {scope === SCOPE_NAMESPACE && (
        <NamespaceRoleBindingsContent
          selectedNamespace={selectedNamespace}
          actionsContainerRef={actionsRef}
        />
      )}
    </Box>
  );
};
