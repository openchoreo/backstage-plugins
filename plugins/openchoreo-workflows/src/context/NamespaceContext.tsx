import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface NamespaceContextValue {
  selectedNamespace: string;
  setSelectedNamespace: (namespace: string) => void;
}

const NamespaceContext = createContext<NamespaceContextValue | undefined>(undefined);

interface NamespaceProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the namespace context.
 * Wrap the workflows page with this to enable namespace selection.
 */
export function NamespaceProvider({ children }: NamespaceProviderProps) {
  const [selectedNamespace, setSelectedNamespace] = useState<string>('');

  const value = useMemo(
    () => ({ selectedNamespace, setSelectedNamespace }),
    [selectedNamespace],
  );

  return (
    <NamespaceContext.Provider value={value}>
      {children}
    </NamespaceContext.Provider>
  );
}

/**
 * Hook to access the namespace context.
 * Must be used within a NamespaceProvider.
 */
export function useNamespaceContext(): NamespaceContextValue {
  const context = useContext(NamespaceContext);
  if (!context) {
    throw new Error('useNamespaceContext must be used within a NamespaceProvider');
  }
  return context;
}

/**
 * Hook to get the selected namespace.
 * Throws if no namespace is selected or if used outside NamespaceProvider.
 */
export function useSelectedNamespace(): string {
  const { selectedNamespace } = useNamespaceContext();
  return selectedNamespace;
}
