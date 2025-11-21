/**
 * Formats a value for display in the changes preview
 * @param value - The value to format
 * @returns Formatted string representation of the value
 */
export const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
