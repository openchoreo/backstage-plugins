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

  // Capture params on mount or when URL changes. Reset to null when the
  // param disappears so stale state doesn't leak across routes (the
  // provider now lives at whole-app scope under Root). Without the
  // explicit reset, visiting `?namespace=foo` anywhere in the app would
  // seed a preselection that persisted into a later `/create` visit
  // with no namespace query.
  useEffect(() => {
    setPreselectedProject(searchParams.get('project'));
    setPreselectedNamespace(searchParams.get('namespace'));
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
