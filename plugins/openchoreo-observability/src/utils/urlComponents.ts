// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

/** Components selected on project-level logs, from the `components` URL parameter. */
export function parseComponentsParam(searchParams: URLSearchParams): string[] {
  const componentsParam = searchParams.get('components');
  return componentsParam
    ? Array.from(
        new Set(
          componentsParam
            .split(',')
            .map(v => v.trim())
            .filter(Boolean),
        ),
      )
    : [];
}
