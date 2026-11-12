import { fireEvent, render, screen } from '@testing-library/react';
import { URLRow } from './InvokeUrlsDialog';

describe('URLRow', () => {
  it('keeps a long URL on one line, with the full URL on hover', () => {
    const url = `https://orders.example.com/${'a'.repeat(200)}`;
    render(<URLRow url={url} label="External" />);

    const link = screen.getByRole('link', { name: url });
    expect(link).toHaveAttribute('title', url);
    expect(link).toHaveStyle({
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    });
  });

  it('shows the security as a padlock with a tooltip', async () => {
    render(
      <URLRow
        url="https://orders.example.com"
        label="External"
        security={{
          scheme: 'apiKey',
          apiKey: { in: 'header', name: 'api-key' },
        }}
      />,
    );

    const lock = screen.getByRole('img', { name: 'API key (header api-key)' });
    fireEvent.mouseOver(lock);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'API key (header api-key)',
    );
  });

  it('shows an open padlock for a URL without authentication', () => {
    render(
      <URLRow
        url="https://orders.example.com"
        label="External"
        security={{ scheme: 'none' }}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'No authentication' }),
    ).toBeInTheDocument();
  });

  it('shows no padlock for a URL that declares no security', () => {
    render(<URLRow url="https://orders.example.com" label="External" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
