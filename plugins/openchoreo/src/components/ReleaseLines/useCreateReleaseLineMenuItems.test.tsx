// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Entity } from '@backstage/catalog-model';
import { useCreateReleaseLineMenuItems } from './useCreateReleaseLineMenuItems';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useComponentUpdatePermission: () => ({
    canUpdateComponent: true,
    loading: false,
  }),
}));

// A create that fails, flipping `creating` on and off like the real mutation.
jest.mock('./useReleaseLines', () => ({
  useReleaseLines: () => {
    const { useState } = jest.requireActual('react');
    const [creating, setCreating] = useState(false);
    return {
      creating,
      createReleaseLine: async () => {
        setCreating(true);
        await Promise.resolve();
        setCreating(false);
        throw new Error('release line next already exists');
      },
    };
  },
}));

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'hello',
    namespace: 'default',
    labels: { 'openchoreo.io/managed': 'true' },
  },
};

const Harness = () => {
  const { extraMenuItems, createReleaseLineDialog } =
    useCreateReleaseLineMenuItems(entity);
  return (
    <>
      <button onClick={extraMenuItems[0].onClick}>open</button>
      {createReleaseLineDialog}
    </>
  );
};

describe('useCreateReleaseLineMenuItems', () => {
  it('keeps the entered name and shows the error when a create fails', async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), {
      target: { value: 'next' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(
      await screen.findByText('release line next already exists'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('next');
  });
});
