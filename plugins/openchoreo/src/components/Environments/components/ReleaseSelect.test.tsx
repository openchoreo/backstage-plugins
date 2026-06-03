import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { ReleaseSelect } from './ReleaseSelect';

const makeRelease = (
  name: string,
  opts: { image?: string; created?: string } = {},
): ComponentRelease =>
  ({
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'ComponentRelease',
    metadata: {
      name,
      creationTimestamp: opts.created ?? '2026-05-28T00:00:00Z',
    },
    spec: {
      workload: {
        container: { image: opts.image ?? 'ghcr.io/x/svc:1' },
      },
    },
  } as unknown as ComponentRelease);

const releases: ComponentRelease[] = [
  makeRelease('rel-newest', { image: 'ghcr.io/x/svc:3' }),
  makeRelease('rel-middle', { image: 'ghcr.io/x/svc:2' }),
  makeRelease('rel-oldest', { image: 'ghcr.io/x/svc:1' }),
];

describe('ReleaseSelect', () => {
  it('shows the selected release in the input', () => {
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('rel-newest')).toBeInTheDocument();
  });

  it('filters options as the user types', async () => {
    const user = userEvent.setup();
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.clear(input);
    await user.type(input, 'oldest');

    const listbox = await screen.findByRole('listbox');
    expect(listbox).toHaveTextContent('rel-oldest');
    expect(listbox).not.toHaveTextContent('rel-newest');
    expect(listbox).not.toHaveTextContent('rel-middle');
  });

  it('calls onSelectedReleaseChange when a different option is picked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={onChange}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    await user.click(await screen.findByText('rel-middle'));
    expect(onChange).toHaveBeenCalledWith('rel-middle');
  });

  it('invokes onCreateRelease from the footer item', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onCreateRelease={onCreate}
        canCreateRelease
        onOpenReleaseBrowser={() => {}}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    await user.click(await screen.findByText('New release'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('invokes onOpenReleaseBrowser from the footer item', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={onOpen}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    await user.click(await screen.findByText('Open Release Browser'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders the env chip next to a release bound to firstEnvironment', async () => {
    const user = userEvent.setup();
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={() => {}}
        deployments={{ 'rel-middle': ['Development'] }}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    const middleOption = (await screen.findByText('rel-middle')).closest('li');
    expect(middleOption).toHaveTextContent('development');
    // Other options should not show the chip.
    const newestOption = screen.getByText('rel-newest').closest('li');
    expect(newestOption).not.toHaveTextContent('development');
  });

  it('omits the env chip inside the closed input when selected is current', () => {
    render(
      <ReleaseSelect
        releases={releases}
        selectedReleaseName="rel-newest"
        onSelectedReleaseChange={() => {}}
        deployments={{ 'rel-newest': ['Development'] }}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    // The name + meta still surface as today; only the env chip is
    // suppressed inside the input (disabled Deploy button is the cue).
    const input = screen.getByDisplayValue('rel-newest');
    const formControl = input.closest('.MuiFormControl-root');
    expect(formControl).not.toBeNull();
    expect(formControl).not.toHaveTextContent('development');
  });

  it('caps the list to 4 most recent releases when not searching', async () => {
    const user = userEvent.setup();
    const many: ComponentRelease[] = Array.from({ length: 8 }, (_, i) =>
      makeRelease(`rel-${i}`),
    );
    render(
      <ReleaseSelect
        releases={many}
        selectedReleaseName="rel-0"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    const listbox = await screen.findByRole('listbox');
    // Only the 4 newest options render (rel-0…rel-3).
    expect(listbox).toHaveTextContent('rel-0');
    expect(listbox).toHaveTextContent('rel-3');
    expect(listbox).not.toHaveTextContent('rel-4');
    expect(listbox).not.toHaveTextContent('rel-7');
    // Truncation hint shows the hidden count.
    expect(
      screen.getByText(/and 4 more in Release Browser/),
    ).toBeInTheDocument();
  });

  it('reveals matches beyond the top-4 cap when the user types', async () => {
    const user = userEvent.setup();
    const many: ComponentRelease[] = Array.from({ length: 8 }, (_, i) =>
      makeRelease(`rel-${i}`),
    );
    render(
      <ReleaseSelect
        releases={many}
        selectedReleaseName="rel-0"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, 'rel-7');
    const listbox = await screen.findByRole('listbox');
    expect(listbox).toHaveTextContent('rel-7');
    expect(
      screen.queryByText(/more in Release Browser/),
    ).not.toBeInTheDocument();
  });

  it('opens the Release Browser when the truncation hint is clicked', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const many: ComponentRelease[] = Array.from({ length: 8 }, (_, i) =>
      makeRelease(`rel-${i}`),
    );
    render(
      <ReleaseSelect
        releases={many}
        selectedReleaseName="rel-0"
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={onOpen}
      />,
    );
    await user.click(screen.getByRole('textbox'));
    await user.click(await screen.findByText(/and 4 more in Release Browser/));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('disables the input when there are no releases', () => {
    render(
      <ReleaseSelect
        releases={[]}
        selectedReleaseName={null}
        onSelectedReleaseChange={() => {}}
        deployments={{}}
        firstEnvironmentName="development"
        onOpenReleaseBrowser={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText('No releases yet')).toBeDisabled();
  });
});
