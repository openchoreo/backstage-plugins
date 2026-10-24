// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ReleaseLineFilter } from './ReleaseLineFilter';

const mockLines = { lines: ['canary', 'next'], loading: false };
jest.mock('../../hooks/useComponentReleaseLines', () => ({
  useComponentReleaseLineState: () => mockLines,
}));

let mockPageLine: string | undefined;
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useReleaseLine: () => ({ releaseLine: mockPageLine }),
}));

const Search = () => <div data-testid="search">{useLocation().search}</div>;

function renderFilter(url = '/', component: string | undefined = 'hello') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ReleaseLineFilter namespace="default" component={component} />
      <Search />
    </MemoryRouter>,
  );
}

describe('ReleaseLineFilter', () => {
  beforeEach(() => {
    mockPageLine = undefined;
    mockLines.lines = ['canary', 'next'];
    mockLines.loading = false;
  });

  it('offers every line, the default line, then each release line', () => {
    renderFilter();

    fireEvent.mouseDown(screen.getByRole('button', { name: /All lines/ }));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map(o => o.textContent),
    ).toEqual(['All lines', 'default', 'canary', 'next']);
  });

  it('keeps the choice in the URL', () => {
    renderFilter();

    fireEvent.mouseDown(screen.getByRole('button', { name: /All lines/ }));
    fireEvent.click(screen.getByRole('option', { name: 'default' }));

    expect(screen.getByTestId('search')).toHaveTextContent(
      '?releaseLine=default',
    );
  });

  it('is hidden for a component without release lines, and clears a stale line', () => {
    mockLines.lines = [];
    renderFilter('/?releaseLine=next');

    expect(screen.queryByLabelText('Release line')).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('');
  });

  it('is hidden on a release line page, which is scoped to its line', () => {
    mockPageLine = 'next';
    renderFilter('/?releaseLine=canary');

    expect(screen.queryByLabelText('Release line')).not.toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent(
      '?releaseLine=canary',
    );
  });
});
