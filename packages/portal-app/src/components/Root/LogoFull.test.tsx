import { render, screen } from '@testing-library/react';
import { configApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider, mockApis } from '@backstage/test-utils';
import type { JsonObject } from '@backstage/types';
import LogoFull from './LogoFull';
import LogoIcon from './LogoIcon';

function renderWithBranding(element: JSX.Element, branding?: JsonObject) {
  return render(
    <TestApiProvider
      apis={[
        [
          configApiRef,
          mockApis.config({
            data: branding ? { app: { branding } } : {},
          }),
        ],
      ]}
    >
      {element}
    </TestApiProvider>,
  );
}

describe('LogoFull', () => {
  it('renders the OpenChoreo mark and wordmark by default', () => {
    const { container } = renderWithBranding(<LogoFull />);
    expect(screen.getByText('OpenChoreo')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a custom wordmark from app.branding.name', () => {
    renderWithBranding(<LogoFull />, { name: 'Acme Portal' });
    expect(screen.getByText('Acme Portal')).toBeInTheDocument();
    expect(screen.queryByText('OpenChoreo')).not.toBeInTheDocument();
  });

  it('renders the configured fullLogo image instead of icon + wordmark', () => {
    const src = 'data:image/svg+xml;base64,abc';
    const { container } = renderWithBranding(<LogoFull />, {
      name: 'Acme Portal',
      fullLogo: src,
    });
    expect(screen.getByRole('img', { name: 'Acme Portal' })).toHaveAttribute(
      'src',
      src,
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(screen.queryByText('Acme Portal')).not.toBeInTheDocument();
  });
});

describe('LogoIcon', () => {
  it('renders the OpenChoreo mark by default', () => {
    const { container } = renderWithBranding(<LogoIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the configured iconLogo image', () => {
    const src = 'data:image/svg+xml;base64,abc';
    const { container } = renderWithBranding(<LogoIcon />, { iconLogo: src });
    expect(container.querySelector('img')).toHaveAttribute('src', src);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
