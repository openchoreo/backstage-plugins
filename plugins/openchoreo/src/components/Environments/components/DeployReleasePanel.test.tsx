import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { DeployReleasePanel } from './DeployReleasePanel';

// Keep the dropdown out of these tests — it has its own coverage in
// ReleaseSelect.test.tsx. The empty-state path doesn't render it, so
// the mock just guards against accidental rendering in the populated
// case test.
jest.mock('./ReleaseSelect', () => ({
  ReleaseSelect: () => <div data-testid="release-select" />,
}));

// Same posture for the browser dialog — we just need to know whether
// the panel rendered it; we don't exercise it here.
jest.mock('./ReleaseBrowserDialog', () => ({
  ReleaseBrowserDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="release-browser-dialog" /> : null,
}));

const makeRelease = (name: string): ComponentRelease =>
  ({
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ComponentRelease',
    metadata: { name, creationTimestamp: '2026-05-28T00:00:00Z' },
    spec: { workload: { container: { image: 'ghcr.io/x/svc:1' } } },
  } as unknown as ComponentRelease);

const testEntity = mockComponentEntity();

const renderPanel = (
  props: Partial<React.ComponentProps<typeof DeployReleasePanel>> = {},
) =>
  render(
    <MemoryRouter>
      <EntityProvider entity={testEntity}>
        <DeployReleasePanel
          releases={[]}
          releasesLoading={false}
          releasesError={null}
          deployments={{}}
          selectedReleaseName={null}
          onSelectedReleaseChange={jest.fn()}
          firstEnvironmentName="development"
          onCreateRelease={jest.fn()}
          canCreateRelease
          {...props}
        />
      </EntityProvider>
    </MemoryRouter>,
  );

describe('DeployReleasePanel — zero releases', () => {
  it('renders the empty-state copy and a Create release CTA instead of the dropdown', () => {
    renderPanel();
    expect(
      screen.getByText(/No releases yet\. Create your first release/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create release/i }),
    ).toBeEnabled();
    // The dropdown and Deploy button must not render in this branch.
    expect(screen.queryByTestId('release-select')).toBeNull();
    expect(screen.queryByRole('button', { name: /^deploy$/i })).toBeNull();
  });

  it('invokes onCreateRelease when the CTA is clicked', async () => {
    const onCreateRelease = jest.fn();
    const user = userEvent.setup();
    renderPanel({ onCreateRelease });
    await user.click(screen.getByRole('button', { name: /create release/i }));
    expect(onCreateRelease).toHaveBeenCalledTimes(1);
  });

  it('disables the CTA and surfaces the reason when not ready to create', async () => {
    const user = userEvent.setup();
    renderPanel({
      canCreateRelease: false,
      createDisabledReason:
        'Build your application first to generate a container image.',
    });
    const button = screen.getByRole('button', { name: /create release/i });
    expect(button).toBeDisabled();
    // MUI Tooltip lazily renders its content on hover. Hovering the
    // wrapper span (button itself is disabled and won't receive
    // pointer events) surfaces the disabled-reason as a tooltip.
    await user.hover(button.parentElement!);
    expect(
      await screen.findByText(
        'Build your application first to generate a container image.',
      ),
    ).toBeInTheDocument();
  });

  it('omits the CTA entirely when onCreateRelease is undefined', () => {
    renderPanel({ onCreateRelease: undefined });
    expect(
      screen.getByText(/No releases yet\. Create your first release/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create release/i }),
    ).toBeNull();
  });

  it('still surfaces a releases-fetch error above the empty block', () => {
    renderPanel({ releasesError: 'Failed to load releases' });
    expect(screen.getByText('Failed to load releases')).toBeInTheDocument();
    expect(
      screen.getByText(/No releases yet\. Create your first release/i),
    ).toBeInTheDocument();
  });
});

describe('DeployReleasePanel — populated', () => {
  it('renders the dropdown and Deploy button, not the empty state', () => {
    renderPanel({
      releases: [makeRelease('rel-1')],
      selectedReleaseName: 'rel-1',
    });
    expect(screen.getByTestId('release-select')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^deploy$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No releases yet/i)).toBeNull();
  });

  it('also takes the populated path while releases are still loading', () => {
    // Loading + empty must NOT show the empty-state copy — we don't
    // yet know if there are no releases or just haven't fetched them.
    renderPanel({ releasesLoading: true });
    expect(screen.queryByText(/No releases yet/i)).toBeNull();
    expect(screen.getByTestId('release-select')).toBeInTheDocument();
  });
});
