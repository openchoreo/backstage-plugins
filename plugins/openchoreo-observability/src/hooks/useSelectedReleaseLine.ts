// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext } from 'react';
import { UNSAFE_LocationContext, useSearchParams } from 'react-router-dom';
import { useReleaseLine } from '@openchoreo/backstage-plugin-react';

/** URL parameter of the release line filter on observability views. */
export const RELEASE_LINE_PARAM = 'releaseLine';

/**
 * The release line an observability view is scoped to: the page's line on a
 * ReleaseLine page, else the line filter's choice. Undefined covers every
 * line of the component, and `default` its default line.
 */
export function useSelectedReleaseLine(): string | undefined {
  const { releaseLine } = useReleaseLine();
  // Read without useSearchParams, which throws outside a router, so the data
  // hooks keep working where no view filters by line.
  const search = useContext(UNSAFE_LocationContext)?.location.search;
  return (
    releaseLine ??
    (new URLSearchParams(search).get(RELEASE_LINE_PARAM) || undefined)
  );
}

/** Reads and sets the line filter's URL parameter; empty is every line. */
export function useReleaseLineParam(): [string, (line: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(RELEASE_LINE_PARAM) ?? '';
  const setValue = useCallback(
    (line: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (line) next.set(RELEASE_LINE_PARAM, line);
          else next.delete(RELEASE_LINE_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  return [value, setValue];
}
