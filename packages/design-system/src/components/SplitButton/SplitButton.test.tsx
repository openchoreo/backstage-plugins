import { render, screen, fireEvent } from '@testing-library/react';
import { SplitButton, SplitButtonOption } from './SplitButton';

const defaultOptions: SplitButtonOption[] = [
  { key: 'build', label: 'Build' },
  { key: 'deploy', label: 'Deploy' },
  { key: 'rollback', label: 'Rollback' },
];

describe('SplitButton', () => {
  it('fires onClick with selected option key on primary button click', () => {
    const onClick = jest.fn();
    render(<SplitButton options={defaultOptions} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(onClick).toHaveBeenCalledWith('build');
  });

  it('opens dropdown menu when arrow button is clicked', () => {
    render(<SplitButton options={defaultOptions} onClick={jest.fn()} />);

    const dropdownButton = screen.getByRole('button', {
      name: 'select action',
    });
    fireEvent.click(dropdownButton);

    expect(screen.getByRole('menuitem', { name: 'Build' })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Deploy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'Rollback' }),
    ).toBeInTheDocument();
  });

  it('changes primary button text when a menu item is selected', () => {
    const onClick = jest.fn();
    render(<SplitButton options={defaultOptions} onClick={onClick} />);

    // Open menu
    fireEvent.click(screen.getByRole('button', { name: 'select action' }));
    // Select 'Deploy'
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deploy' }));

    // Now the primary button should say 'Deploy'
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeInTheDocument();

    // Click it and verify the key
    fireEvent.click(screen.getByRole('button', { name: 'Deploy' }));
    expect(onClick).toHaveBeenCalledWith('deploy');
  });

  it('prevents click when disabled', () => {
    const onClick = jest.fn();
    render(<SplitButton options={defaultOptions} onClick={onClick} disabled />);

    const primaryButton = screen.getByRole('button', { name: 'Build' });
    expect(primaryButton).toBeDisabled();
    fireEvent.click(primaryButton);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders all options in the dropdown menu', () => {
    render(<SplitButton options={defaultOptions} onClick={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'select action' }));

    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems).toHaveLength(3);
  });
});
