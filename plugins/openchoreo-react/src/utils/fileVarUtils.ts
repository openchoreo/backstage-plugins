import type {
  FileVar,
  ModelsWorkload,
} from '@openchoreo/backstage-plugin-common';

/**
 * Status of a file mount in the override context.
 * - 'inherited': From base workload, not overridden
 * - 'overridden': Has a base value that is being overridden
 * - 'extra': In the persisted overrides but not in the base workload
 * - 'new': Added by the user in the current form session and not in base
 */
export type FileVarStatus = 'inherited' | 'overridden' | 'extra' | 'new';

/**
 * File mount with its override status metadata.
 */
export interface FileVarWithStatus {
  /** The file mount data */
  fileVar: FileVar;
  /** The status indicating if it's inherited, overridden, or new */
  status: FileVarStatus;
  /** Original base value if status is 'overridden' */
  baseValue?: FileVar;
  /** Actual index in the container.files array (only for overridden/new) */
  actualIndex?: number;
}

/**
 * Merges base workload file mounts with override file mounts into a unified list.
 * Returns status for each: inherited, overridden, extra, or new.
 *
 * When `initialOverrideFileVars` is provided, an override key not in `base` is
 * tagged `'extra'` if it was already in `initial` and `'new'` otherwise.
 * When omitted, falls back to legacy behavior (everything not-in-base → `'new'`).
 *
 * File mounts are matched by their key (file name).
 */
export function mergeFileVarsWithStatus(
  baseFileVars: FileVar[],
  overrideFileVars: FileVar[],
  initialOverrideFileVars?: FileVar[],
): FileVarWithStatus[] {
  const result: FileVarWithStatus[] = [];
  const baseMap = new Map(baseFileVars.map(f => [f.key, f]));
  const initialKeys = initialOverrideFileVars
    ? new Set(initialOverrideFileVars.map(f => f.key))
    : undefined;

  // Create a map of override keys to their actual indices in the array
  const overrideIndexMap = new Map(
    overrideFileVars.map((f, idx) => [f.key, idx]),
  );

  // Add base file vars first (inherited or overridden)
  for (const baseFile of baseFileVars) {
    const actualIndex = overrideIndexMap.get(baseFile.key);
    if (actualIndex !== undefined) {
      result.push({
        fileVar: overrideFileVars[actualIndex],
        status: 'overridden',
        baseValue: baseFile,
        actualIndex,
      });
    } else {
      result.push({
        fileVar: baseFile,
        status: 'inherited',
      });
    }
  }

  // Add override file vars not present in base ('extra' if loaded, else 'new').
  for (let i = 0; i < overrideFileVars.length; i++) {
    const overrideFile = overrideFileVars[i];
    if (!baseMap.has(overrideFile.key)) {
      const status: FileVarStatus =
        initialKeys && initialKeys.has(overrideFile.key) ? 'extra' : 'new';
      result.push({
        fileVar: overrideFile,
        status,
        actualIndex: i,
      });
    }
  }

  return result;
}

/**
 * Extract base file mounts for a specific container from the workload.
 *
 * @param baseWorkload - The base workload data
 * @param containerName - Name of the container to get file mounts for
 * @returns Array of file mounts for the container, or empty array if not found
 */
export function getBaseFileVarsForContainer(
  baseWorkload: ModelsWorkload | null,
): FileVar[] {
  return (baseWorkload?.container as any)?.files || [];
}

/**
 * Format a file var value for display.
 * Handles both plain values and secret references.
 *
 * @param fileVar - The file mount to format
 * @returns Display string for the value
 */
export function formatFileVarValue(fileVar: FileVar): string {
  if (fileVar.valueFrom?.secretKeyRef) {
    const { name, key } = fileVar.valueFrom.secretKeyRef;
    return `Secret: ${name}/${key}`;
  }
  if (fileVar.value !== undefined && fileVar.value.length > 0) {
    // Show a preview of the content
    return getFileVarContentPreview(fileVar.value, 1);
  }
  return '';
}

/**
 * Get a preview of file content, truncated to a maximum number of lines.
 *
 * @param content - The file content
 * @param maxLines - Maximum number of lines to show (default: 2)
 * @returns Truncated content preview
 */
export function getFileVarContentPreview(
  content: string,
  maxLines: number = 2,
): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return `${lines.slice(0, maxLines).join('\n')}...`;
}
