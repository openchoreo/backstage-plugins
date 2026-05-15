import { resourceYamlEditorValidation } from './ResourceYamlEditorExtension';

function makeValidation() {
  const errors: string[] = [];
  return {
    addError: (msg: string) => {
      errors.push(msg);
    },
    errors,
  };
}

const validYaml = `apiVersion: openchoreo.dev/v1alpha1
kind: Resource
metadata:
  name: analytics-db
spec:
  owner:
    projectName: analytics
  type:
    kind: ResourceType
    name: postgres
  parameters:
    size: small
`;

describe('resourceYamlEditorValidation', () => {
  it('passes for a fully populated Resource YAML', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(validYaml, v as any);
    expect(v.errors).toEqual([]);
  });

  it('rejects empty input', () => {
    const v = makeValidation();
    resourceYamlEditorValidation('', v as any);
    expect(v.errors).toEqual([
      'Resource YAML definition is required',
    ]);
  });

  it('rejects whitespace-only input', () => {
    const v = makeValidation();
    resourceYamlEditorValidation('   \n\t  ', v as any);
    expect(v.errors).toEqual([
      'Resource YAML definition is required',
    ]);
  });

  it('rejects malformed YAML', () => {
    const v = makeValidation();
    resourceYamlEditorValidation('{ unclosed: [bracket', v as any);
    expect(v.errors[0]).toMatch(/Invalid YAML/);
  });

  it('rejects a YAML scalar (not an object)', () => {
    const v = makeValidation();
    resourceYamlEditorValidation('just-a-string', v as any);
    expect(v.errors).toContain('YAML content must be a valid object');
  });

  it('rejects a non-Resource kind', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      validYaml.replace('kind: Resource', 'kind: ResourceType'),
      v as any,
    );
    expect(v.errors).toContain('Kind must be Resource');
  });

  it('rejects an unexpected apiVersion', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      validYaml.replace(
        'apiVersion: openchoreo.dev/v1alpha1',
        'apiVersion: v1',
      ),
      v as any,
    );
    expect(v.errors).toContain(
      "apiVersion must be 'openchoreo.dev/v1alpha1'",
    );
  });

  it('rejects YAML missing metadata.name', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      `apiVersion: openchoreo.dev/v1alpha1
kind: Resource
metadata: {}
spec:
  owner:
    projectName: analytics
  type:
    kind: ResourceType
    name: postgres
`,
      v as any,
    );
    expect(v.errors).toContain('metadata.name is required');
  });

  it('rejects YAML missing spec.owner.projectName', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      `apiVersion: openchoreo.dev/v1alpha1
kind: Resource
metadata:
  name: analytics-db
spec:
  type:
    kind: ResourceType
    name: postgres
`,
      v as any,
    );
    expect(v.errors).toContain('spec.owner.projectName is required');
  });

  it('rejects YAML missing spec.type.name', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      `apiVersion: openchoreo.dev/v1alpha1
kind: Resource
metadata:
  name: analytics-db
spec:
  owner:
    projectName: analytics
  type:
    kind: ResourceType
`,
      v as any,
    );
    expect(v.errors).toContain('spec.type.name is required');
  });

  it('rejects YAML missing spec.type.kind', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      `apiVersion: openchoreo.dev/v1alpha1
kind: Resource
metadata:
  name: analytics-db
spec:
  owner:
    projectName: analytics
  type:
    name: postgres
`,
      v as any,
    );
    expect(v.errors).toContain(
      'spec.type.kind must be either "ResourceType" or "ClusterResourceType"',
    );
  });

  it('rejects YAML with an unsupported spec.type.kind value', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      validYaml.replace('kind: ResourceType', 'kind: SomethingElse'),
      v as any,
    );
    expect(v.errors).toContain(
      'spec.type.kind must be either "ResourceType" or "ClusterResourceType"',
    );
  });

  it('accepts ClusterResourceType as a valid spec.type.kind', () => {
    const v = makeValidation();
    resourceYamlEditorValidation(
      validYaml.replace('kind: ResourceType', 'kind: ClusterResourceType'),
      v as any,
    );
    expect(v.errors).toEqual([]);
  });
});
