import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectParametersConfigWrapper } from './ProjectParametersConfigWrapper';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Stub the page so we can drive its onBack / onContinue callbacks directly.
jest.mock('./ProjectParametersConfigPage', () => ({
  ProjectParametersConfigPage: ({ onBack, onContinue }: any) => (
    <div>
      <button onClick={onBack}>back</button>
      <button onClick={() => onContinue('development', 'rel-2')}>
        continue
      </button>
    </div>
  ),
}));

beforeEach(() => jest.clearAllMocks());

describe('ProjectParametersConfigWrapper', () => {
  it('navigates back to the deploy view on Back', () => {
    render(
      <MemoryRouter>
        <ProjectParametersConfigWrapper />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('back'));
    expect(mockNavigate).toHaveBeenCalledWith('..', { relative: 'path' });
  });

  it('hands off to the overrides wizard in deploy mode on Continue', () => {
    render(
      <MemoryRouter>
        <ProjectParametersConfigWrapper />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('continue'));
    expect(mockNavigate).toHaveBeenCalledWith(
      '../overrides/development?action=deploy&release=rel-2',
      { relative: 'path' },
    );
  });
});
