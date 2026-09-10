import { render, act, screen } from '@testing-library/react';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { FieldValidation } from '@rjsf/utils';
import {
  ClusterProjectTypeYamlEditorExtension,
  clusterProjectTypeYamlEditorValidation,
} from './ClusterProjectTypeYamlEditorExtension';

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

describe('ClusterProjectTypeYamlEditorExtension', () => {
  beforeEach(() => {
    editorProps = {};
  });

  it('renders the help text and the YAML editor', () => {
    render(<ClusterProjectTypeYamlEditorExtension {...makeProps()} />);
    expect(screen.getByTestId('yaml-editor')).toBeInTheDocument();
    expect(
      screen.getByText(/Customize the ClusterProjectType definition/),
    ).toBeInTheDocument();
  });

  it('auto-generates initial YAML from step-1 form data when formData is empty', () => {
    const onChange = jest.fn();
    render(
      <ClusterProjectTypeYamlEditorExtension
        {...makeProps({
          onChange,
          formContext: {
            formData: {
              clusterprojecttype_name: 'standard',
              displayName: 'Standard',
              description: 'desc',
            },
          } as any,
        })}
      />,
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const generated = onChange.mock.calls[0][0] as string;
    expect(generated).toContain('kind: ClusterProjectType');
    expect(generated).toContain('name: standard');
    expect(generated).toContain('${metadata.namespace}');
  });

  it('does not overwrite YAML the user has already edited', () => {
    const onChange = jest.fn();
    render(
      <ClusterProjectTypeYamlEditorExtension
        {...makeProps({
          onChange,
          formData: 'kind: ClusterProjectType\nmetadata:\n  name: edited',
          formContext: {
            formData: { clusterprojecttype_name: 'standard' },
          } as any,
        })}
      />,
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears the error text when edited content is valid YAML', () => {
    const onChange = jest.fn();
    render(
      <ClusterProjectTypeYamlEditorExtension {...makeProps({ onChange })} />,
    );

    act(() => {
      editorProps.onChange!('kind: ClusterProjectType');
    });

    expect(onChange).toHaveBeenCalledWith('kind: ClusterProjectType');
    expect(editorProps.errorText).toBeUndefined();
  });

  it('surfaces a parse error when edited content is invalid YAML', () => {
    render(<ClusterProjectTypeYamlEditorExtension {...makeProps()} />);

    act(() => {
      editorProps.onChange!('{ invalid');
    });

    expect(editorProps.errorText).toMatch(/YAML parse error/);
  });

  it('renders rawErrors when present', () => {
    render(
      <ClusterProjectTypeYamlEditorExtension
        {...makeProps({ rawErrors: ['required field missing'] })}
      />,
    );
    expect(screen.getByText('required field missing')).toBeInTheDocument();
  });
});

describe('clusterProjectTypeYamlEditorValidation', () => {
  const run = (value: string) => {
    const errors: string[] = [];
    const validation = {
      addError: (m: string) => errors.push(m),
    } as unknown as FieldValidation;
    clusterProjectTypeYamlEditorValidation(value, validation);
    return errors;
  };

  it('requires a non-empty value', () => {
    expect(run('')).toContain('ClusterProjectType YAML definition is required');
    expect(run('   ')).toContain(
      'ClusterProjectType YAML definition is required',
    );
  });

  it('passes for a valid ClusterProjectType definition', () => {
    const yaml = `apiVersion: openchoreo.dev/v1alpha1
kind: ClusterProjectType
metadata:
  name: standard
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
kind: ProjectType
metadata:
  name: standard
`;
    expect(run(yaml)).toContain('Kind must be ClusterProjectType');
  });

  it('rejects a wrong apiVersion', () => {
    const yaml = `apiVersion: v1
kind: ClusterProjectType
metadata:
  name: standard
`;
    expect(run(yaml)).toContain("apiVersion must be 'openchoreo.dev/v1alpha1'");
  });

  it('requires metadata.name', () => {
    const yaml = `apiVersion: openchoreo.dev/v1alpha1
kind: ClusterProjectType
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
