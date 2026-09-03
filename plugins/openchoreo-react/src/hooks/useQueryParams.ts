import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type ParamValue = string | string[] | undefined;

interface ParamConfig {
  /** Default value when param is not in URL */
  defaultValue?: ParamValue;
  /** Custom parser for the URL string value */
  parse?: (value: string | null) => ParamValue;
  /** Custom serializer for setting the URL value */
  serialize?: (value: ParamValue) => string | undefined;
}

/**
 * Hook for managing URL query parameters with type-safe defaults and serialization.
 *
 * @example
 * ```tsx
 * const [params, setParams] = useQueryParams({
 *   tab: { defaultValue: 'runs' },
 *   env: { defaultValue: undefined },
 *   components: {
 *     defaultValue: [],
 *     parse: (v) => v?.split(',').filter(Boolean) || [],
 *     serialize: (v) => Array.isArray(v) && v.length > 0 ? v.join(',') : undefined,
 *   },
 * });
 *
 * // Read values
 * console.log(params.tab, params.env, params.components);
 *
 * // Update values (merges with existing)
 * setParams({ tab: 'configurations' });
 * ```
 */
export function useQueryParams<T extends Record<string, ParamValue>>(
  config: Record<keyof T, ParamConfig>,
): [T, (updates: Partial<T>, options?: { replace?: boolean }) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const result = {} as Record<string, ParamValue>;

    for (const [key, conf] of Object.entries(config)) {
      const raw = searchParams.get(key);

      if (conf.parse) {
        result[key] = conf.parse(raw);
      } else if (raw === null) {
        result[key] = conf.defaultValue;
      } else {
        result[key] = raw;
      }
    }

    return result as T;
  }, [searchParams, config]);

  const setValues = useCallback(
    (updates: Partial<T>, options?: { replace?: boolean }) => {
      const newParams = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        const conf = config[key as keyof T];

        if (value === undefined || value === null) {
          newParams.delete(key);
        } else if (conf?.serialize) {
          const serialized = conf.serialize(value as ParamValue);
          if (serialized !== undefined) {
            newParams.set(key, serialized);
          } else {
            newParams.delete(key);
          }
        } else if (Array.isArray(value)) {
          if (value.length > 0) {
            newParams.set(key, value.join(','));
          } else {
            newParams.delete(key);
          }
        } else {
          // Check if value equals default - if so, remove from URL
          const defaultVal = conf?.defaultValue;
          if (value === defaultVal) {
            newParams.delete(key);
          } else {
            newParams.set(key, String(value));
          }
        }
      }

      setSearchParams(newParams, { replace: options?.replace ?? true });
    },
    [searchParams, setSearchParams, config],
  );

  return [values, setValues];
}
