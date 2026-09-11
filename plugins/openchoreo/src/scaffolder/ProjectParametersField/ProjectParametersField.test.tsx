import { render, screen } from '@testing-library/react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { ProjectParametersField } from './ProjectParametersField';

// Capture the props handed to RjsfForm so we can assert what schema/formData
// the field forwards and drive its onChange.
let rjsfProps: any = {};

jest.mock('@openchoreo/backstage-design-system', () => ({
  RjsfForm: (props: any) => {
    rjsfProps = props;
    return <div data-testid="rjsf-form" />;
  },
}));

const makeProps = (
  uiOptions: Record<string, unknown>,
  overrides: Partial<
    FieldExtensionComponentProps<Record<string, unknown>>
  > = {},
): FieldExtensionComponentProps<Record<string, unknown>> =>
  ({
    onChange: jest.fn(),
    formData: undefined,
    uiSchema: { 'ui:options': uiOptions },
    ...overrides,
  } as unknown as FieldExtensionComponentProps<Record<string, unknown>>);

const schemaWithFields = {
  type: 'object',
  properties: { replicas: { type: 'integer', title: 'Replicas' } },
};

describe('ProjectParametersField', () => {
  beforeEach(() => {
    rjsfProps = {};
  });

  it('renders the RJSF form and help text when the type has parameters', () => {
    render(
      <ProjectParametersField
        {...makeProps({
          ptdSchema: schemaWithFields,
          ptdDisplayName: 'Web Application',
        })}
      />,
    );

    expect(screen.getByTestId('rjsf-form')).toBeInTheDocument();
    expect(
      screen.getByText(/Fill in the parameters defined by Web Application/),
    ).toBeInTheDocument();
    expect(rjsfProps.schema).toEqual(schemaWithFields);
  });

  it('seeds the form with existing formData', () => {
    render(
      <ProjectParametersField
        {...makeProps(
          { ptdSchema: schemaWithFields, ptdDisplayName: 'Web Application' },
          { formData: { replicas: 3 } },
        )}
      />,
    );
    expect(rjsfProps.formData).toEqual({ replicas: 3 });
  });

  it('propagates RJSF onChange to the field onChange', () => {
    const onChange = jest.fn();
    render(
      <ProjectParametersField
        {...makeProps(
          { ptdSchema: schemaWithFields, ptdDisplayName: 'Web Application' },
          { onChange },
        )}
      />,
    );

    rjsfProps.onChange({ formData: { replicas: 5 } });
    expect(onChange).toHaveBeenCalledWith({ replicas: 5 });

    // A form change with no formData should fall back to an empty object.
    rjsfProps.onChange({});
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('shows the empty-state when the type has no parameters schema', () => {
    render(
      <ProjectParametersField
        {...makeProps({ ptdDisplayName: 'Minimal Type' })}
      />,
    );
    expect(screen.queryByTestId('rjsf-form')).not.toBeInTheDocument();
    expect(
      screen.getByText('Minimal Type has no configurable parameters.'),
    ).toBeInTheDocument();
  });

  it('shows the empty-state when the schema declares no properties', () => {
    render(
      <ProjectParametersField
        {...makeProps({
          ptdSchema: { type: 'object', properties: {} },
          ptdDisplayName: 'Empty Type',
        })}
      />,
    );
    expect(screen.queryByTestId('rjsf-form')).not.toBeInTheDocument();
    expect(
      screen.getByText('Empty Type has no configurable parameters.'),
    ).toBeInTheDocument();
  });

  it('falls back to "this project" when no display name is provided', () => {
    render(<ProjectParametersField {...makeProps({})} />);
    expect(
      screen.getByText('this project has no configurable parameters.'),
    ).toBeInTheDocument();
  });
});
