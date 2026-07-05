import { render, screen } from '@testing-library/react';
import { SwitchField } from './SwitchFieldExtension';

const makeProps = (overrides: Record<string, unknown> = {}) =>
  ({
    onChange: jest.fn(),
    rawErrors: [],
    formData: false,
    schema: { title: 'Auto Deploy', description: 'Deploys the project' },
    uiSchema: {},
    ...overrides,
  } as any);

describe('SwitchField', () => {
  it('renders the title and description', () => {
    render(<SwitchField {...makeProps()} />);

    expect(screen.getByText('Auto Deploy')).toBeInTheDocument();
    expect(screen.getByText('Deploys the project')).toBeInTheDocument();
  });

  it('shows the ui:options.offWarning while the switch is off', () => {
    render(
      <SwitchField
        {...makeProps({
          formData: false,
          uiSchema: {
            'ui:options': { offWarning: 'You will need to deploy manually.' },
          },
        })}
      />,
    );

    expect(
      screen.getByText('You will need to deploy manually.'),
    ).toBeInTheDocument();
  });

  it('hides the warning while the switch is on', () => {
    render(
      <SwitchField
        {...makeProps({
          formData: true,
          uiSchema: {
            'ui:options': { offWarning: 'You will need to deploy manually.' },
          },
        })}
      />,
    );

    expect(
      screen.queryByText('You will need to deploy manually.'),
    ).not.toBeInTheDocument();
  });

  it('renders no warning when offWarning is not configured', () => {
    const { container } = render(
      <SwitchField {...makeProps({ formData: false })} />,
    );

    expect(container.querySelector('.MuiAlert-root')).toBeNull();
  });
});
