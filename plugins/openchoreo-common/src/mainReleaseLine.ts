// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * The implicit main line every component has. It is not a ReleaseLine
 * resource, and resources of the main line leave `owner.releaseLine` empty.
 */
export const MAIN_RELEASE_LINE = 'main';

/** A name reserved besides `main`: no release line can take it. */
const RESERVED_RELEASE_LINE = 'default';

/** True for the main line, given by name or as an empty line. */
export function isMainReleaseLine(line?: string | null): boolean {
  const trimmed = line?.trim();
  return !trimmed || trimmed === MAIN_RELEASE_LINE;
}

/**
 * The line to write into a resource or request: undefined for the main line, so the
 * keyword `main` is never stored.
 */
export function toStoredReleaseLine(line?: string | null): string | undefined {
  return isMainReleaseLine(line) ? undefined : line!.trim();
}

/** True when two lines are the same line, the main line given by name or as empty. */
export function isSameReleaseLine(
  a?: string | null,
  b?: string | null,
): boolean {
  return (toStoredReleaseLine(a) ?? '') === (toStoredReleaseLine(b) ?? '');
}

/** Why a new release line can't take a name, or undefined when it can. */
export function reservedReleaseLineNameError(name: string): string | undefined {
  switch (name.trim()) {
    case MAIN_RELEASE_LINE:
      return `${MAIN_RELEASE_LINE} is the implicit line of every component`;
    case RESERVED_RELEASE_LINE:
      return `${RESERVED_RELEASE_LINE} is reserved, the component's implicit line is ${MAIN_RELEASE_LINE}`;
    default:
      return undefined;
  }
}
