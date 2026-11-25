// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { toStoredReleaseLine } from '@openchoreo/backstage-plugin-common';
import { RELEASE_LINE_PARAM } from '../hooks/useSelectedReleaseLine';

/**
 * URL parameters that only make sense on project-level logs: the component
 * selection, and the column set (the component page offers different columns).
 */
const PROJECT_ONLY_PARAMS = ['components', 'fields'];

/**
 * Link from a project-level log entry to its component's logs page. Carries
 * over the current environment, time range, log levels, search, sort and live
 * mode, which both pages read from the same URL parameters.
 *
 * The release line comes from the entry rather than the project page, so the
 * component page shows the line that wrote the entry: the entry's release
 * line, or the component's default (its main line) for a main-line entry.
 */
export function componentLogsUrl(
  catalogNamespace: string,
  componentName: string,
  searchParams: URLSearchParams,
  releaseLineName?: string,
): string {
  const params = new URLSearchParams(searchParams);
  PROJECT_ONLY_PARAMS.forEach(param => params.delete(param));
  params.delete(RELEASE_LINE_PARAM);
  const releaseLine = toStoredReleaseLine(releaseLineName);
  if (releaseLine) {
    params.set(RELEASE_LINE_PARAM, releaseLine);
  }
  const query = params.toString();
  return `/catalog/${encodeURIComponent(
    catalogNamespace,
  )}/component/${encodeURIComponent(componentName)}/runtime-logs${
    query ? `?${query}` : ''
  }`;
}
