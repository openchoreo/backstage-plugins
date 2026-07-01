import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectEnvironmentOverridesWrapper } from './ProjectEnvironmentOverridesWrapper';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Stub the page so we can read the props the wrapper computes from the route.
jest.mock('./ProjectEnvironmentOverridesPage', () => ({
  ProjectEnvironmentOverridesPage: ({
    envName,
    releaseFromUrl,
    onBack,
  }: any) => (
    <div>
      <span data-testid="envName">{envName}</span>
      <span data-testid="release">{releaseFromUrl ?? '(none)'}</span>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

beforeEach(() => jest.clearAllMocks());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/overrides/:envName"
          element={<ProjectEnvironmentOverridesWrapper />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProjectEnvironmentOverridesWrapper', () => {
  it('passes releaseFromUrl in deploy mode', () => {
    renderAt('/overrides/development?action=deploy&release=rel-2');
    expect(screen.getByTestId('envName').textContent).toBe('development');
    expect(screen.getByTestId('release').textContent).toBe('rel-2');
  });

  it('omits releaseFromUrl when action is not deploy', () => {
    renderAt('/overrides/development?release=rel-2');
    expect(screen.getByTestId('release').textContent).toBe('(none)');
  });

  it('navigates back up two segments on Back', () => {
    renderAt('/overrides/development?action=deploy&release=rel-2');
    fireEvent.click(screen.getByText('back'));
    expect(mockNavigate).toHaveBeenCalledWith('../..', { relative: 'path' });
  });
});
