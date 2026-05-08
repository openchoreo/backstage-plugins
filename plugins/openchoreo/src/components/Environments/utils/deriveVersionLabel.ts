/**
 * Reduce a container image reference to a short label suitable for a
 * compact node — typically the tag (`v3.0.9`, `latest`) or, when the
 * image was pinned by digest, a short digest prefix (`sha256:abc1234`).
 * Returns `undefined` when no usable label can be derived; callers
 * decide their own placeholder.
 */
export function deriveVersionLabel(image?: string): string | undefined {
  if (!image) return undefined;
  const trimmed = image.trim();
  if (!trimmed) return undefined;

  const atIdx = trimmed.indexOf('@');
  if (atIdx !== -1) {
    const digest = trimmed.slice(atIdx + 1);
    const colonIdx = digest.indexOf(':');
    if (colonIdx !== -1) {
      const algo = digest.slice(0, colonIdx);
      const hex = digest.slice(colonIdx + 1);
      return `${algo}:${hex.slice(0, 7)}`;
    }
    return digest.slice(0, 12);
  }

  const lastSlash = trimmed.lastIndexOf('/');
  const afterSlash = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  const colonIdx = afterSlash.indexOf(':');
  if (colonIdx !== -1) {
    const tag = afterSlash.slice(colonIdx + 1);
    return tag || undefined;
  }
  return undefined;
}
