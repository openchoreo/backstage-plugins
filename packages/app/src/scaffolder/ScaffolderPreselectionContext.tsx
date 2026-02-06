import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface ScaffolderPreselectionContextValue {
  preselectedProject: string | null;
  clearPreselectedProject: () => void;
}

const ScaffolderPreselectionContext =
  createContext<ScaffolderPreselectionContextValue>({
    preselectedProject: null,
    clearPreselectedProject: () => {},
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
 * Captures `project` query parameter from URLs like:
 * /create?filters[type]=component&project=my-project
 *
 * The value persists across client-side navigations within the scaffolder
 * (e.g., from template list to template form).
 */
export const ScaffolderPreselectionProvider = ({
  children,
}: ScaffolderPreselectionProviderProps) => {
  const [searchParams] = useSearchParams();
  const [preselectedProject, setPreselectedProject] = useState<string | null>(
    null,
  );

  // Capture project param on mount or when URL changes
  useEffect(() => {
    const projectParam = searchParams.get('project');
    if (projectParam) {
      setPreselectedProject(projectParam);
    }
  }, [searchParams]);

  const clearPreselectedProject = () => {
    setPreselectedProject(null);
  };

  return (
    <ScaffolderPreselectionContext.Provider
      value={{ preselectedProject, clearPreselectedProject }}
    >
      {children}
    </ScaffolderPreselectionContext.Provider>
  );
};
