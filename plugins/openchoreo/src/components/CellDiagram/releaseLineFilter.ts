// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import type { Project } from '@openchoreo/cell-diagram';
import { DEFAULT_RELEASE_LINE } from '@openchoreo/backstage-plugin-common';

/**
 * The release lines a diagram shows, besides the default line: the pills of the nodes of
 * components with release lines.
 */
export function diagramReleaseLines(project?: Project): string[] {
  const lines = new Set<string>();
  for (const component of project?.components ?? []) {
    if (component.badge && component.badge !== DEFAULT_RELEASE_LINE) {
      lines.add(component.badge);
    }
  }
  return [...lines].sort((a, b) => a.localeCompare(b));
}

/**
 * The diagram narrowed to one line: components with release lines keep only
 * that line's node, and components without lines stay. Connections to a node
 * left out are dropped. An empty line keeps every line.
 */
export function filterProjectByReleaseLine(
  project: Project,
  line: string,
): Project {
  if (!line) return project;
  const removed = new Set(
    project.components
      .filter(component => component.badge && component.badge !== line)
      .map(component => component.id),
  );
  if (removed.size === 0) return project;

  // Connection ids read `{namespace}:{project}:{node}:{endpoint}`.
  const targetsRemoved = (connectionId: string) => {
    const [, projectName, nodeId] = connectionId.split(':');
    return projectName === project.id && removed.has(nodeId);
  };
  return {
    ...project,
    components: project.components
      .filter(component => !removed.has(component.id))
      .map(component => ({
        ...component,
        connections: component.connections.filter(
          connection => !targetsRemoved(connection.id),
        ),
      })),
  };
}
