import { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface ScaffolderPreselectionContextValue {
  preselectedProject: string | null;
  clearPreselectedProject: () => void;
  preselectedNamespace: string | null;
  clearPreselectedNamespace: () => void;
}

const ScaffolderPreselectionContext =
  createContext<ScaffolderPreselectionContextValue>({
    preselectedProject: null,
    clearPreselectedProject: () => {},
    preselectedNamespace: null,
    clearPreselectedNamespace: () => {},
  });

/**
 * Hook to access scaffolder preselection values
 */
export const useScaffolderPreselection = () =>
  useContext(ScaffolderPreselectionContext);

interface ScaffolderPreselectionProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that captures preselection parameters from the URL
 * and makes them available to scaffolder field components.
 *
 * Captures `project` and `namespace` query parameters from URLs like:
 * /create?filters[type]=component&project=my-project&namespace=engineering
 *
 * The values persist across client-side navigations within the scaffolder
 * (e.g., from template list to template form).
 */
export const ScaffolderPreselectionProvider = ({
  children,
}: ScaffolderPreselectionProviderProps) => {
  const [searchParams] = useSearchParams();
  const [preselectedProject, setPreselectedProject] = useState<string | null>(
    null,
  );
  const [preselectedNamespace, setPreselectedNamespace] = useState<
    string | null
  >(null);

  // Capture params on mount or when URL changes
  useEffect(() => {
    const projectParam = searchParams.get('project');
    if (projectParam) {
      setPreselectedProject(projectParam);
    }
    const namespaceParam = searchParams.get('namespace');
    if (namespaceParam) {
      setPreselectedNamespace(namespaceParam);
    }
  }, [searchParams]);

  const clearPreselectedProject = () => {
    setPreselectedProject(null);
  };

  const clearPreselectedNamespace = () => {
    setPreselectedNamespace(null);
  };

  return (
    <ScaffolderPreselectionContext.Provider
      value={{
        preselectedProject,
        clearPreselectedProject,
        preselectedNamespace,
        clearPreselectedNamespace,
      }}
    >
      {children}
    </ScaffolderPreselectionContext.Provider>
  );
};
