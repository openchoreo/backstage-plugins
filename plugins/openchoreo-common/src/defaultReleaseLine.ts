// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * The implicit default line every component has. It is not a ReleaseLine
 * resource, and resources of the default line leave `owner.releaseLine` empty.
 */
export const DEFAULT_RELEASE_LINE = 'default';

/** True for the default line, given by name or as an empty line. */
export function isDefaultReleaseLine(line?: string | null): boolean {
  const trimmed = line?.trim();
  return !trimmed || trimmed === DEFAULT_RELEASE_LINE;
}

/**
 * The line to write into a resource or request: undefined for the default line, so the
 * keyword `default` is never stored.
 */
export function toStoredReleaseLine(line?: string | null): string | undefined {
  return isDefaultReleaseLine(line) ? undefined : line!.trim();
}

/** True when two lines are the same line, the default line given by name or as empty. */
export function isSameReleaseLine(
  a?: string | null,
  b?: string | null,
): boolean {
  return (toStoredReleaseLine(a) ?? '') === (toStoredReleaseLine(b) ?? '');
}
