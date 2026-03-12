export function shouldNavigateOnRowClick(event: unknown): boolean {
  const e = event as globalThis.MouseEvent;
  if (
    e.defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  )
    return false;
  const target = e.target;
  if (!(target instanceof Element)) return true;
  const interactive = target.closest(
    'a, button, input, textarea, select, [role="button"]',
  );
  // Allow if the only matched interactive element is the row container itself
  if (interactive && interactive !== e.currentTarget) return false;
  return true;
}
