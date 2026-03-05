import { useState, useRef } from 'react';
import { Box } from '@material-ui/core';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE, BindingScope } from '../constants';
import { ScopeDropdown } from '../ScopeDropdown';
import { ClusterRolesContent } from './ClusterRolesContent';
import { NamespaceRolesContent } from './NamespaceRolesContent';
import { NamespaceSelector } from './NamespaceSelector';
import { useQueryParams } from '../../../hooks/useQueryParams';

export const RolesTab = () => {
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
          clusterLabel="Cluster Roles"
          namespaceLabel="Namespace Roles"
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
        <ClusterRolesContent actionsContainerRef={actionsRef} />
      )}
      {scope === SCOPE_NAMESPACE && (
        <NamespaceRolesContent
          selectedNamespace={selectedNamespace}
          actionsContainerRef={actionsRef}
        />
      )}
    </Box>
  );
};
