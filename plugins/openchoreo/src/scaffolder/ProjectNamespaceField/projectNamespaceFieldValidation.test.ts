// Keep the module import light: the component pulls in Backstage React APIs
// and the openchoreo hook, none of which the pure validator needs.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useComponentCreateContextPermission: () => ({
    allowed: true,
    loading: false,
  }),
}));

import { projectNamespaceFieldValidation } from './ProjectNamespaceField';

function makeValidation() {
  const errors: string[] = [];
  return { errors, addError: (e: string) => errors.push(e) };
}

// The ABAC denial branch is driven by an async hook that populates a
// module-scoped ref; that wiring is exercised in the component render test.
// Here we cover the synchronous required-field logic.
describe('projectNamespaceFieldValidation', () => {
  it('requires both project and namespace when empty', () => {
    const v = makeValidation();
    projectNamespaceFieldValidation(
      { project_name: '', namespace_name: '' },
      v,
    );
    expect(v.errors).toContain('Project is required');
    expect(v.errors).toContain('Namespace is required');
  });

  it('flags only the missing field', () => {
    const v = makeValidation();
    projectNamespaceFieldValidation(
      { project_name: 'system:acme/payments', namespace_name: '' },
      v,
    );
    expect(v.errors).toEqual(['Namespace is required']);
  });

  it('treats whitespace-only values as missing', () => {
    const v = makeValidation();
    projectNamespaceFieldValidation(
      { project_name: '   ', namespace_name: '  ' },
      v,
    );
    expect(v.errors).toContain('Project is required');
    expect(v.errors).toContain('Namespace is required');
  });

  it('passes when both are present', () => {
    const v = makeValidation();
    projectNamespaceFieldValidation(
      { project_name: 'system:acme/payments', namespace_name: 'acme' },
      v,
    );
    expect(v.errors).toEqual([]);
  });
});
