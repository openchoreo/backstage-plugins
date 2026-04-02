import { render, screen, fireEvent } from '@testing-library/react';
import { FormYamlToggle } from './FormYamlToggle';

describe('FormYamlToggle', () => {
  it('renders Form and YAML toggle buttons', () => {
    render(<FormYamlToggle value="form" onChange={jest.fn()} />);

    expect(screen.getByText('Form')).toBeInTheDocument();
    expect(screen.getByText('YAML')).toBeInTheDocument();
  });

  it('calls onChange with "yaml" when YAML button is clicked', () => {
    const onChange = jest.fn();
    render(<FormYamlToggle value="form" onChange={onChange} />);

    fireEvent.click(screen.getByText('YAML'));
    expect(onChange).toHaveBeenCalledWith('yaml');
  });

  it('calls onChange with "form" when Form button is clicked', () => {
    const onChange = jest.fn();
    render(<FormYamlToggle value="yaml" onChange={onChange} />);

    fireEvent.click(screen.getByText('Form'));
    expect(onChange).toHaveBeenCalledWith('form');
  });

  it('marks the current value as selected', () => {
    render(<FormYamlToggle value="yaml" onChange={jest.fn()} />);

    const yamlButton = screen.getByText('YAML').closest('button');
    expect(yamlButton).toHaveAttribute('aria-pressed', 'true');

    const formButton = screen.getByText('Form').closest('button');
    expect(formButton).toHaveAttribute('aria-pressed', 'false');
  });
});
