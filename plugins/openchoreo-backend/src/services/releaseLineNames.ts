// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'crypto';

const HASH_LENGTH = 8;
const MAX_NAME_LENGTH = 63;

/**
 * The name OpenChoreo gives a line's component-level objects
 * (`releaseline.ComponentLineName`): the component name for the main line,
 * and `{component}-{line}-{hash}`, bounded to 63 characters, for a release line.
 */
export function componentLineName(
  componentName: string,
  releaseLine?: string,
): string {
  if (!releaseLine) {
    return componentName;
  }
  // Hashes "{component}-{line}_{line}", as releaseline.lineName does.
  const names = [componentName, releaseLine];
  return generateName(
    MAX_NAME_LENGTH,
    `${names.join('-')}_${releaseLine}`,
    names,
  );
}

/**
 * The name OpenChoreo gives a control plane object of a component's line, such
 * as its Workload or a ReleaseBinding (`releaseline.ScopedName`).
 */
export function scopedName(
  componentName: string,
  releaseLine: string | undefined,
  suffix: string,
): string {
  return `${componentLineName(componentName, releaseLine)}-${suffix}`;
}

// Mirrors GenerateK8sNameWithHashInput in OpenChoreo's internal/dataplane/kubernetes.
function generateName(
  limit: number,
  hashInput: string,
  names: string[],
): string {
  const hash = createHash('sha256')
    .update(hashInput)
    .digest('hex')
    .slice(0, HASH_LENGTH);
  // A separator between the parts and one before the hash.
  const maxBaseLength = limit - HASH_LENGTH - names.length;
  const partLength = Math.floor(maxBaseLength / names.length);
  const extraChars = maxBaseLength % names.length;
  const base = names
    .map(sanitize)
    .map((name, i) => name.slice(0, partLength + (i < extraChars ? 1 : 0)))
    .join('-');
  return `${base}-${hash}`.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function sanitize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.-]/gu, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}
