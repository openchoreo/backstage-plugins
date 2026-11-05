// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext } from 'react';
import { UNSAFE_LocationContext, useSearchParams } from 'react-router-dom';
import {
  Entity,
  parseEntityRef,
  RELATION_HAS_PART,
} from '@backstage/catalog-model';
import { MAIN_RELEASE_LINE } from '@openchoreo/backstage-plugin-common';
import { useReleaseLine } from '@openchoreo/backstage-plugin-react';

/** URL parameter of the release line filter on observability views. */
export const RELEASE_LINE_PARAM = 'releaseLine';

/**
 * Line filter value that covers every line, for views whose default is a
 * single line. No release line can take it as a name.
 */
export const ALL_RELEASE_LINES = '*';

/**
 * The line a component's own observability view shows before any choice: the
 * main line of a component with release lines, else every line.
 */
export function componentDefaultReleaseLine(
  entity: Entity,
): string | undefined {
  const hasLines = entity.relations?.some(
    r =>
      r.type === RELATION_HAS_PART &&
      parseEntityRef(r.targetRef).kind.toLocaleLowerCase('en-US') ===
        'releaseline',
  );
  return hasLines ? MAIN_RELEASE_LINE : undefined;
}

/**
 * The release line an observability view is scoped to: the page's line on a
 * ReleaseLine page, else the line filter's choice, else `defaultLine`.
 * Undefined covers every line of the component, and `main` its main line.
 */
export function useSelectedReleaseLine(
  defaultLine?: string,
): string | undefined {
  const { releaseLine } = useReleaseLine();
  // Read without useSearchParams, which throws outside a router, so the data
  // hooks keep working where no view filters by line.
  const search = useContext(UNSAFE_LocationContext)?.location.search;
  const line =
    releaseLine ??
    (new URLSearchParams(search).get(RELEASE_LINE_PARAM) || defaultLine);
  return line === ALL_RELEASE_LINES ? undefined : line;
}

/** Reads and sets the line filter's URL parameter; empty is the view's default. */
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
