import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvokeUrlsDialog } from './InvokeUrlsDialog';

jest.mock('@backstage/plugin-catalog-react', () => ({
  entityRouteRef: {},
}));
jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useRouteRef:
    () =>
    ({ kind, namespace, name }: any) =>
      `/catalog/${namespace}/${kind}/${name}`,
}));

describe('InvokeUrlsDialog', () => {
  it('shows ReleaseBinding URLs without security or an Endpoint, as for a component without Endpoints', () => {
    render(
      <MemoryRouter>
        <InvokeUrlsDialog
          open
          onClose={() => {}}
          endpoints={[
            {
              name: 'http',
              type: 'HTTP',
              externalURLs: {
                https: {
                  scheme: 'https',
                  host: 'greeter.example.com',
                  port: 443,
                },
              },
              serviceURL: { scheme: 'http', host: 'greeter.svc', port: 8080 },
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('https://greeter.example.com:443'),
    ).toBeInTheDocument();
    expect(screen.getByText('http://greeter.svc:8080')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Manage Endpoint/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it("shows an Endpoint's URLs per visibility, with their security and a button to manage the Endpoint", () => {
    const onClose = jest.fn();
    render(
      <MemoryRouter>
        <InvokeUrlsDialog
          open
          onClose={onClose}
          namespaceName="acme"
          endpoints={[
            {
              name: 'http',
              endpointName: 'greeter-http',
              externalURLs: {
                https: {
                  scheme: 'https',
                  host: 'api.example.com',
                  port: 0,
                  path: '/greeter',
                  security: {
                    scheme: 'apiKey',
                    apiKey: { in: 'header', name: 'api-key' },
                  },
                },
              },
              namespaceURLs: {
                http: { scheme: 'http', host: 'greeter.ns.local', port: 0 },
              },
              projectURL: {
                scheme: 'http',
                host: 'greeter.project.local',
                port: 0,
                path: '/greeter',
              },
              serviceURL: { scheme: 'http', host: 'greeter.svc', port: 8080 },
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('https://api.example.com/greeter'),
    ).toBeInTheDocument();
    expect(screen.getByText('Namespace')).toBeInTheDocument();
    expect(screen.getByText('http://greeter.ns.local')).toBeInTheDocument();
    // The Endpoint's project URL replaces the in-cluster service URL.
    expect(
      screen.getByText('http://greeter.project.local/greeter'),
    ).toBeInTheDocument();
    expect(screen.queryByText('http://greeter.svc:8080')).toBeNull();
    expect(
      screen.getByRole('img', { name: 'API key (header api-key)' }),
    ).toBeInTheDocument();
    // MUI renders the button as a link to the Endpoint's page.
    const manage = screen.getByRole('button', {
      name: 'Manage Endpoint greeter-http',
    });
    expect(manage).toHaveAttribute(
      'href',
      '/catalog/acme/endpoint/greeter-http',
    );
    fireEvent.click(manage);
    expect(onClose).toHaveBeenCalled();
  });
});
