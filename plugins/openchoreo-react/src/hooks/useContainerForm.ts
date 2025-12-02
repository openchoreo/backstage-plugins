import { useState, useCallback, useEffect } from 'react';
import type {
  Container,
  EnvVar,
  FileVar,
} from '@openchoreo/backstage-plugin-common';

export interface UseContainerFormOptions {
  /** Initial containers state */
  initialContainers?: Record<string, Container>;
  /** Callback fired whenever containers change */
  onChange?: (containers: Record<string, Container>) => void;
}

export interface UseContainerFormResult {
  /** Current containers state */
  containers: Record<string, Container>;
  /** Directly set the containers state (for external updates like loading from API) */
  setContainers: (containers: Record<string, Container>) => void;
  /** Update a specific field on a container */
  handleContainerChange: (
    containerName: string,
    field: keyof Container,
    value: any,
  ) => void;
  /** Update a specific field on an environment variable */
  handleEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: any,
  ) => void;
  /** Update a specific field on a file mount */
  handleFileVarChange: (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: any,
  ) => void;
  /** Add a new container */
  handleAddContainer: () => void;
  /** Remove a container by name */
  handleRemoveContainer: (containerName: string) => void;
  /** Add a new environment variable to a container */
  handleAddEnvVar: (containerName: string) => void;
  /** Remove an environment variable from a container */
  handleRemoveEnvVar: (containerName: string, envIndex: number) => void;
  /** Add a new file mount to a container */
  handleAddFileVar: (containerName: string) => void;
  /** Remove a file mount from a container */
  handleRemoveFileVar: (containerName: string, fileIndex: number) => void;
  /** Update array fields (command, args) from comma-separated string */
  handleArrayFieldChange: (
    containerName: string,
    field: 'command' | 'args',
    value: string,
  ) => void;
}

/**
 * Hook for managing container form state with all CRUD operations.
 *
 * Provides internal state management for containers including:
 * - Adding/removing containers
 * - Adding/removing environment variables
 * - Adding/removing file mounts
 * - Updating individual fields
 *
 * @example
 * ```tsx
 * const { containers, handleAddContainer, ...handlers } = useContainerForm({
 *   initialContainers: existingContainers,
 *   onChange: (containers) => saveToBackend(containers),
 * });
 *
 * return <ContainerContent containers={containers} {...handlers} />;
 * ```
 */
export function useContainerForm(
  options: UseContainerFormOptions = {},
): UseContainerFormResult {
  const { initialContainers = {}, onChange } = options;

  const [containers, setContainersInternal] =
    useState<Record<string, Container>>(initialContainers);

  // Sync with initial containers when they change externally
  useEffect(() => {
    setContainersInternal(initialContainers);
  }, [initialContainers]);

  // Wrapper to call onChange when state updates
  const setContainers = useCallback(
    (newContainers: Record<string, Container>) => {
      setContainersInternal(newContainers);
      onChange?.(newContainers);
    },
    [onChange],
  );

  const handleContainerChange = useCallback(
    (containerName: string, field: keyof Container, value: any) => {
      setContainersInternal(prev => {
        const updated = {
          ...prev,
          [containerName]: {
            ...(prev[containerName] || {}),
            [field]: value,
          } as Container,
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleEnvVarChange = useCallback(
    (
      containerName: string,
      envIndex: number,
      field: keyof EnvVar,
      value: any,
    ) => {
      setContainersInternal(prev => {
        const container = prev[containerName];
        if (!container) return prev;

        const updatedEnvVars = [...(container.env || [])];
        updatedEnvVars[envIndex] = {
          ...updatedEnvVars[envIndex],
          [field]: value,
        };

        const updated = {
          ...prev,
          [containerName]: {
            ...container,
            env: updatedEnvVars,
          },
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleFileVarChange = useCallback(
    (
      containerName: string,
      fileIndex: number,
      field: keyof FileVar,
      value: any,
    ) => {
      setContainersInternal(prev => {
        const container = prev[containerName];
        if (!container) return prev;

        const files = (container as any).files || [];
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          [field]: value,
        };

        const updated = {
          ...prev,
          [containerName]: {
            ...container,
            files: updatedFiles,
          } as Container,
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleAddContainer = useCallback(() => {
    setContainersInternal(prev => {
      const containerCount = Object.keys(prev).length;
      const containerName =
        containerCount === 0 ? 'main' : `container-${containerCount}`;

      // Container type from OpenAPI only has: image, command?, args?, env?
      // The container name is used as the key in the containers map
      const newContainer: Container = {
        image: '',
        env: [],
        command: [],
        args: [],
      };

      const updated = {
        ...prev,
        [containerName]: newContainer,
      };
      onChange?.(updated);
      return updated;
    });
  }, [onChange]);

  const handleRemoveContainer = useCallback(
    (containerName: string) => {
      setContainersInternal(prev => {
        const updated = { ...prev };
        delete updated[containerName];
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleAddEnvVar = useCallback(
    (containerName: string) => {
      setContainersInternal(prev => {
        const container = prev[containerName];
        if (!container) return prev;

        const newEnvVar: EnvVar = { key: '', value: '' };
        const updated = {
          ...prev,
          [containerName]: {
            ...container,
            env: [...(container.env || []), newEnvVar],
          },
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleRemoveEnvVar = useCallback(
    (containerName: string, envIndex: number) => {
      setContainersInternal(prev => {
        const container = prev[containerName];
        if (!container) return prev;

        const updated = {
          ...prev,
          [containerName]: {
            ...container,
            env: container.env?.filter((_, index) => index !== envIndex) || [],
          },
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleAddFileVar = useCallback(
    (containerName: string) => {
      setContainersInternal(prev => {
        const container = prev[containerName];
        if (!container) return prev;

        const newFileVar: FileVar = { key: '', mountPath: '', value: '' };
        const files = (container as any).files || [];

        const updated = {
          ...prev,
          [containerName]: {
            ...container,
            files: [...files, newFileVar],
          } as Container,
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleRemoveFileVar = useCallback(
    (containerName: string, fileIndex: number) => {
      setContainersInternal(prev => {
        const container = prev[containerName];
        if (!container) return prev;

        const files = (container as any).files || [];
        const updated = {
          ...prev,
          [containerName]: {
            ...container,
            files: files.filter((_: any, index: number) => index !== fileIndex),
          } as Container,
        };
        onChange?.(updated);
        return updated;
      });
    },
    [onChange],
  );

  const handleArrayFieldChange = useCallback(
    (containerName: string, field: 'command' | 'args', value: string) => {
      const arrayValue = value
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      handleContainerChange(containerName, field, arrayValue);
    },
    [handleContainerChange],
  );

  return {
    containers,
    setContainers,
    handleContainerChange,
    handleEnvVarChange,
    handleFileVarChange,
    handleAddContainer,
    handleRemoveContainer,
    handleAddEnvVar,
    handleRemoveEnvVar,
    handleAddFileVar,
    handleRemoveFileVar,
    handleArrayFieldChange,
  };
}
