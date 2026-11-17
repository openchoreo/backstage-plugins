// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * URL parameters that only make sense on project-level logs: the component
 * selection, and the column set (the component page offers different columns).
 */
const PROJECT_ONLY_PARAMS = ['components', 'fields'];

/**
 * Link from a project-level log entry to its component's logs page. Carries
 * over the current environment, time range, log levels, search, sort and live
 * mode, which both pages read from the same URL parameters.
 */
export function componentLogsUrl(
  catalogNamespace: string,
  componentName: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams);
  PROJECT_ONLY_PARAMS.forEach(param => params.delete(param));
  const query = params.toString();
  return `/catalog/${encodeURIComponent(
    catalogNamespace,
  )}/component/${encodeURIComponent(componentName)}/runtime-logs${
    query ? `?${query}` : ''
  }`;
}
