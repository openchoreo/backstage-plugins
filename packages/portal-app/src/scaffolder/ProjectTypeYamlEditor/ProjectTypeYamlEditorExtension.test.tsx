import { render, act, screen } from '@testing-library/react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  ProjectTypeYamlEditorExtension,
  projectTypeYamlEditorValidation,
} from './ProjectTypeYamlEditorExtension';

// jsdom's test environment doesn't expose structuredClone, which the extension
// uses to clone its default template; it is available in the real app runtime.
if (typeof globalThis.structuredClone === 'undefined') {
  (globalThis as any).structuredClone = (v: unknown) =>
    JSON.parse(JSON.stringify(v));
}

// Capture the props the YamlEditor receives so we can drive onChange and
// assert on the content / errorText the extension passes down.
let editorProps: {
  content?: string;
  onChange?: (c: string) => void;
  errorText?: string;
} = {};

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  YamlEditor: (props: any) => {
    editorProps = props;
    return <div data-testid="yaml-editor" />;
  },
}));

jest.mock('./styles', () => ({
  useStyles: () => ({
    helpText: 'helpText',
    helpLink: 'helpLink',
    container: 'container',
    errorText: 'errorText',
  }),
}));

const makeProps = (
  overrides: Partial<FieldExtensionComponentProps<string>> = {},
): FieldExtensionComponentProps<string> =>
  ({
    onChange: jest.fn(),
    rawErrors: [],
    formData: undefined,
    formContext: {},
    ...overrides,
  } as unknown as FieldExtensionComponentProps<string>);

describe('ProjectTypeYamlEditorExtension', () => {
  beforeEach(() => {
    editorProps = {};
  });

  it('renders the help text and the YAML editor', () => {
    render(<ProjectTypeYamlEditorExtension {...makeProps()} />);
    expect(screen.getByTestId('yaml-editor')).toBeInTheDocument();
    expect(
      screen.getByText(/Customize the ProjectType definition/),
    ).toBeInTheDocument();
  });

  it('auto-generates initial YAML from step-1 form data when formData is empty', () => {
    const onChange = jest.fn();
    render(
      <ProjectTypeYamlEditorExtension
        {...makeProps({
          onChange,
          formContext: {
            formData: {
              projecttype_name: 'web-service',
              displayName: 'Web Service',
              description: 'desc',
            },
          } as any,
        })}
      />,
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const generated = onChange.mock.calls[0][0] as string;
    expect(generated).toContain('kind: ProjectType');
    expect(generated).toContain('name: web-service');
    expect(generated).toContain('${metadata.namespace}');
  });

  it('does not overwrite YAML the user has already edited', () => {
    const onChange = jest.fn();
    render(
      <ProjectTypeYamlEditorExtension
        {...makeProps({
          onChange,
          formData: 'kind: ProjectType\nmetadata:\n  name: edited',
          formContext: {
            formData: { projecttype_name: 'web-service' },
          } as any,
        })}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the error text when edited content is valid YAML', () => {
    const onChange = jest.fn();
    render(<ProjectTypeYamlEditorExtension {...makeProps({ onChange })} />);

    act(() => {
      editorProps.onChange!('kind: ProjectType');
    });

    expect(onChange).toHaveBeenCalledWith('kind: ProjectType');
    expect(editorProps.errorText).toBeUndefined();
  });

  it('surfaces a parse error when edited content is invalid YAML', () => {
    render(<ProjectTypeYamlEditorExtension {...makeProps()} />);

    act(() => {
      editorProps.onChange!('{ invalid');
    });

    expect(editorProps.errorText).toMatch(/YAML parse error/);
  });

  it('renders rawErrors when present', () => {
    render(
      <ProjectTypeYamlEditorExtension
        {...makeProps({ rawErrors: ['required field missing'] })}
      />,
    );
    expect(screen.getByText('required field missing')).toBeInTheDocument();
  });
});

describe('projectTypeYamlEditorValidation', () => {
  const run = (value: string) => {
    const errors: string[] = [];
    const validation = {
      addError: (m: string) => errors.push(m),
    } as unknown as FieldValidation;
    projectTypeYamlEditorValidation(value, validation);
    return errors;
  };

  it('requires a non-empty value', () => {
    expect(run('')).toContain('ProjectType YAML definition is required');
    expect(run('   ')).toContain('ProjectType YAML definition is required');
  });

  it('passes for a valid ProjectType definition', () => {
    const yaml = `apiVersion: openchoreo.dev/v1alpha1
kind: ProjectType
metadata:
  name: web-service
`;
    expect(run(yaml)).toHaveLength(0);
  });

  it('rejects a non-object document', () => {
    expect(run('just a string')).toContain(
      'YAML content must be a valid object',
    );
  });

  it('rejects a wrong kind', () => {
    const yaml = `apiVersion: openchoreo.dev/v1alpha1
kind: ResourceType
metadata:
  name: web-service
`;
    expect(run(yaml)).toContain('Kind must be ProjectType');
  });

  it('rejects a wrong apiVersion', () => {
    const yaml = `apiVersion: v1
kind: ProjectType
metadata:
  name: web-service
`;
    expect(run(yaml)).toContain("apiVersion must be 'openchoreo.dev/v1alpha1'");
  });

  it('requires metadata.name', () => {
    const yaml = `apiVersion: openchoreo.dev/v1alpha1
kind: ProjectType
metadata: {}
`;
    expect(run(yaml)).toContain('metadata.name is required');
  });

  it('reports a parse error for malformed YAML', () => {
    expect(run('{ invalid').some(e => e.startsWith('Invalid YAML:'))).toBe(
      true,
    );
  });
});
