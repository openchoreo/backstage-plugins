/**
 * Change detection utilities for comparing objects and formatting change values.
 * Used across plugins to track modifications and display diffs.
 */

/**
 * Represents a single change between two values
 */
export interface Change {
  /** Dot-notation path to the changed field (e.g., "config.nested.key") */
  path: string;
  /** Type of change */
  type: 'new' | 'modified' | 'removed';
  /** Previous value (undefined for 'new' changes) */
  oldValue?: unknown;
  /** New value (undefined for 'removed' changes) */
  newValue?: unknown;
}

/**
 * Options for formatting change values
 */
export interface FormatValueOptions {
  /** Maximum length for string values before truncating */
  maxLength?: number;
  /** Whether to quote string values */
  quoteStrings?: boolean;
}

const DEFAULT_FORMAT_OPTIONS: FormatValueOptions = {
  maxLength: 100,
  quoteStrings: true,
};

/**
 * Formats a value for display in change diffs.
 * Handles primitives nicely and provides type indicators for complex values.
 *
 * @param value - The value to format
 * @param options - Formatting options
 * @returns Formatted string representation
 */
export function formatChangeValue(
  value: unknown,
  options: FormatValueOptions = {},
): string {
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };

  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    let str = value;
    if (opts.maxLength && str.length > opts.maxLength) {
      str = `${str.substring(0, opts.maxLength)}...`;
    }
    return opts.quoteStrings ? `"${str}"` : str;
  }

  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 3) {
      const items = value.map(v => formatChangeValue(v, opts)).join(', ');
      return `[${items}]`;
    }
    return `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length <= 2) {
      const entries = keys
        .map(
          k =>
            `${k}: ${formatChangeValue(
              (value as Record<string, unknown>)[k],
              opts,
            )}`,
        )
        .join(', ');
      return `{${entries}}`;
    }
    return `{${keys.length} fields}`;
  }

  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return '[Symbol]';

  return String(value);
}

/**
 * Checks if a value is a plain object (not array, null, or other special types)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Compares two arrays and returns changes at the item level where possible.
 * For arrays of primitives, compares by value.
 * For arrays of objects, compares by index (positional).
 */
function compareArrays(
  arr1: unknown[],
  arr2: unknown[],
  basePath: string,
): Change[] {
  const changes: Change[] = [];
  const maxLen = Math.max(arr1.length, arr2.length);

  for (let i = 0; i < maxLen; i++) {
    const itemPath = `${basePath}[${i}]`;
    const val1 = arr1[i];
    const val2 = arr2[i];

    if (i >= arr1.length) {
      // New item added
      changes.push({
        path: itemPath,
        type: 'new',
        newValue: val2,
      });
    } else if (i >= arr2.length) {
      // Item removed
      changes.push({
        path: itemPath,
        type: 'removed',
        oldValue: val1,
      });
    } else if (isPlainObject(val1) && isPlainObject(val2)) {
      // Recurse into objects
      changes.push(...deepCompareObjects(val1, val2, itemPath));
    } else if (Array.isArray(val1) && Array.isArray(val2)) {
      // Recurse into nested arrays
      changes.push(...compareArrays(val1, val2, itemPath));
    } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      // Primitive or mixed type change
      changes.push({
        path: itemPath,
        type: 'modified',
        oldValue: val1,
        newValue: val2,
      });
    }
  }

  return changes;
}

/**
 * Deep comparison of two objects, returning an array of changes.
 * Traverses nested objects and arrays to find leaf-level changes.
 *
 * @param obj1 - The original/initial object
 * @param obj2 - The current/modified object
 * @param basePath - Base path for dot-notation (internal use)
 * @returns Array of Change objects describing differences
 *
 * @example
 * ```ts
 * const changes = deepCompareObjects(
 *   { config: { replicas: 2 } },
 *   { config: { replicas: 3, newField: 'value' } }
 * );
 * // Returns:
 * // [
 * //   { path: 'config.replicas', type: 'modified', oldValue: 2, newValue: 3 },
 * //   { path: 'config.newField', type: 'new', newValue: 'value' }
 * // ]
 * ```
 */
export function deepCompareObjects(
  obj1: unknown,
  obj2: unknown,
  basePath: string = '',
): Change[] {
  const changes: Change[] = [];

  // Handle non-object cases at root
  if (!isPlainObject(obj1) && !isPlainObject(obj2)) {
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      return compareArrays(obj1, obj2, basePath);
    }
    if (JSON.stringify(obj1) !== JSON.stringify(obj2)) {
      let changeType: Change['type'] = 'modified';
      if (obj1 === undefined) {
        changeType = 'new';
      } else if (obj2 === undefined) {
        changeType = 'removed';
      }
      return [
        {
          path: basePath || '.',
          type: changeType,
          oldValue: obj1,
          newValue: obj2,
        },
      ];
    }
    return [];
  }

  // Normalize to objects
  const o1 = (isPlainObject(obj1) ? obj1 : {}) as Record<string, unknown>;
  const o2 = (isPlainObject(obj2) ? obj2 : {}) as Record<string, unknown>;

  // Get all unique keys from both objects
  const allKeys = new Set([...Object.keys(o1), ...Object.keys(o2)]);

  for (const key of allKeys) {
    const currentPath = basePath ? `${basePath}.${key}` : key;
    const val1 = o1[key];
    const val2 = o2[key];

    if (val1 === undefined && val2 !== undefined) {
      // New field
      if (isPlainObject(val2)) {
        // Expand new nested objects
        changes.push(...deepCompareObjects({}, val2, currentPath));
      } else if (Array.isArray(val2)) {
        changes.push(...compareArrays([], val2, currentPath));
      } else {
        changes.push({
          path: currentPath,
          type: 'new',
          newValue: val2,
        });
      }
    } else if (val1 !== undefined && val2 === undefined) {
      // Removed field
      if (isPlainObject(val1)) {
        // Expand removed nested objects
        changes.push(...deepCompareObjects(val1, {}, currentPath));
      } else if (Array.isArray(val1)) {
        changes.push(...compareArrays(val1, [], currentPath));
      } else {
        changes.push({
          path: currentPath,
          type: 'removed',
          oldValue: val1,
        });
      }
    } else if (isPlainObject(val1) && isPlainObject(val2)) {
      // Recurse into nested objects
      changes.push(...deepCompareObjects(val1, val2, currentPath));
    } else if (Array.isArray(val1) && Array.isArray(val2)) {
      // Compare arrays
      changes.push(...compareArrays(val1, val2, currentPath));
    } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      // Value changed (primitives or type change)
      changes.push({
        path: currentPath,
        type: 'modified',
        oldValue: val1,
        newValue: val2,
      });
    }
  }

  return changes;
}

/**
 * Calculates summary statistics for a list of changes
 */
export interface ChangeStats {
  total: number;
  new: number;
  modified: number;
  removed: number;
}

/**
 * Get statistics about a list of changes
 */
export function getChangeStats(changes: Change[]): ChangeStats {
  return changes.reduce(
    (stats, change) => {
      stats.total++;
      stats[change.type]++;
      return stats;
    },
    { total: 0, new: 0, modified: 0, removed: 0 },
  );
}
