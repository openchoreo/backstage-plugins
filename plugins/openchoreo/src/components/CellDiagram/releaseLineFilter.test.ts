// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import type { Project } from '@openchoreo/cell-diagram';
import {
  diagramReleaseLines,
  filterProjectByReleaseLine,
} from './releaseLineFilter';

const node = (id: string, badge?: string, targets: string[] = []) =>
  ({
    id,
    label: id.split('@')[0],
    badge,
    version: '1.0.0',
    type: 'service',
    services: {},
    connections: targets.map(target => ({
      id: `default:shop:${target}:http`,
      label: target,
      type: 'http',
      onPlatform: true,
    })),
  } as any);

const project = {
  id: 'shop',
  name: 'shop',
  modelVersion: '0.4.0',
  components: [
    node('api', 'default'),
    node('api@next', 'next'),
    node('web', undefined, ['api', 'api@next']),
  ],
} as unknown as Project;

describe('releaseLineFilter', () => {
  it('lists the release lines besides the default line', () => {
    expect(diagramReleaseLines(project)).toEqual(['next']);
  });

  it('keeps every node for all lines', () => {
    expect(filterProjectByReleaseLine(project, '')).toBe(project);
  });

  it("keeps one line's nodes, components without lines, and their links", () => {
    const filtered = filterProjectByReleaseLine(project, 'default');

    expect(filtered.components.map(c => c.id)).toEqual(['api', 'web']);
    expect(filtered.components[1].connections.map(c => c.id)).toEqual([
      'default:shop:api:http',
    ]);
  });
});
