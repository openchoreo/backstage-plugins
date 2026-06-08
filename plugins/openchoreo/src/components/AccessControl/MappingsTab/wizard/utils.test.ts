import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../../constants';
import { ActionInfo } from '../../hooks';
import {
  buildScopePath,
  expandWildcardRoleActions,
  getCompatibleConditionActions,
  getConditionableActions,
  getK8sNameError,
  toK8sName,
} from './utils';

const catalog: ActionInfo[] = [
  {
    name: 'releasebindings:create',
    conditions: [{ key: 'resource.env', description: '' }],
  },
  {
    name: 'releasebindings:delete',
    conditions: [{ key: 'resource.env', description: '' }],
  },
  {
    name: 'releasebindings:view',
    conditions: [],
  },
  {
    name: 'roles:create',
    conditions: [{ key: 'resource.scope', description: '' }],
  },
] as unknown as ActionInfo[];

describe('expandWildcardRoleActions', () => {
  it('returns concrete action names unchanged', () => {
    expect(
      expandWildcardRoleActions(
        ['releasebindings:create', 'releasebindings:view'],
        catalog,
      ),
    ).toEqual(['releasebindings:create', 'releasebindings:view']);
  });

  it('expands a `prefix:*` wildcard against the catalog', () => {
    expect(expandWildcardRoleActions(['releasebindings:*'], catalog)).toEqual([
      'releasebindings:create',
      'releasebindings:delete',
      'releasebindings:view',
    ]);
  });

  it('mixes wildcards and concrete names without duplicates', () => {
    expect(
      expandWildcardRoleActions(
        ['releasebindings:*', 'releasebindings:create'],
        catalog,
      ),
    ).toEqual([
      'releasebindings:create',
      'releasebindings:delete',
      'releasebindings:view',
    ]);
  });

  it('returns an empty array when given no actions', () => {
    expect(expandWildcardRoleActions([], catalog)).toEqual([]);
  });

  it('returns the original action when the wildcard does not match the catalog', () => {
    expect(expandWildcardRoleActions(['unknown:*'], catalog)).toEqual([]);
  });
});

describe('getConditionableActions', () => {
  it('keeps only actions whose catalog entry has conditions', () => {
    expect(
      getConditionableActions(
        ['releasebindings:create', 'releasebindings:view', 'roles:create'],
        catalog,
      ),
    ).toEqual(['releasebindings:create', 'roles:create']);
  });

  it('expands wildcards before filtering', () => {
    expect(getConditionableActions(['releasebindings:*'], catalog)).toEqual([
      'releasebindings:create',
      'releasebindings:delete',
    ]);
  });

  it('drops actions that are not in the catalog', () => {
    expect(getConditionableActions(['ghost:action'], catalog)).toEqual([]);
  });

  it('returns an empty array when nothing is conditionable', () => {
    expect(getConditionableActions(['releasebindings:view'], catalog)).toEqual(
      [],
    );
  });
});

describe('getCompatibleConditionActions', () => {
  const compatCatalog: ActionInfo[] = [
    {
      name: 'releasebindings:create',
      conditions: [
        { key: 'resource.env', description: '' },
        { key: 'resource.project', description: '' },
      ],
    },
    {
      name: 'releasebindings:delete',
      conditions: [{ key: 'resource.env', description: '' }],
    },
    {
      name: 'roles:create',
      conditions: [{ key: 'resource.scope', description: '' }],
    },
    {
      name: 'releasebindings:view',
      conditions: [],
    },
  ] as unknown as ActionInfo[];

  const roleActions = [
    'releasebindings:create',
    'releasebindings:delete',
    'roles:create',
    'releasebindings:view',
  ];

  it('returns all conditionable actions when nothing is selected', () => {
    expect(
      getCompatibleConditionActions([], roleActions, compatCatalog),
    ).toEqual([
      'releasebindings:create',
      'releasebindings:delete',
      'roles:create',
    ]);
  });

  it('keeps only actions sharing a condition with the selection', () => {
    expect(
      getCompatibleConditionActions(
        ['releasebindings:create'],
        roleActions,
        compatCatalog,
      ),
    ).toEqual(['releasebindings:create', 'releasebindings:delete']);
  });

  it('always retains the selected actions', () => {
    expect(
      getCompatibleConditionActions(
        ['roles:create'],
        roleActions,
        compatCatalog,
      ),
    ).toEqual(['roles:create']);
  });

  it('narrows to the shared-condition intersection across the selection', () => {
    // create has {env, project}, delete has {env}; intersection is {env},
    // so roles:create (scope only) stays excluded.
    expect(
      getCompatibleConditionActions(
        ['releasebindings:create', 'releasebindings:delete'],
        roleActions,
        compatCatalog,
      ),
    ).toEqual(['releasebindings:create', 'releasebindings:delete']);
  });

  it('returns just the selection when the actions share no condition', () => {
    expect(
      getCompatibleConditionActions(
        ['releasebindings:delete', 'roles:create'],
        roleActions,
        compatCatalog,
      ),
    ).toEqual(['releasebindings:delete', 'roles:create']);
  });
});

describe('buildScopePath', () => {
  describe('cluster bindings', () => {
    it('returns cluster:* when nothing is set', () => {
      expect(
        buildScopePath(
          { namespace: '', project: '', component: '' },
          SCOPE_CLUSTER,
        ),
      ).toBe('cluster:*');
    });

    it('returns ns-only path with wildcard suffix', () => {
      expect(
        buildScopePath(
          { namespace: 'default', project: '', component: '' },
          SCOPE_CLUSTER,
        ),
      ).toBe('ns:default/*');
    });

    it('returns ns + project with wildcard component', () => {
      expect(
        buildScopePath(
          { namespace: 'default', project: 'myproj', component: '' },
          SCOPE_CLUSTER,
        ),
      ).toBe('ns:default/proj:myproj/*');
    });

    it('returns full path when all parts are set', () => {
      expect(
        buildScopePath(
          { namespace: 'default', project: 'myproj', component: 'api' },
          SCOPE_CLUSTER,
        ),
      ).toBe('ns:default/proj:myproj/comp:api');
    });

    it('returns empty when project is set without a namespace', () => {
      expect(
        buildScopePath(
          { namespace: '', project: 'myproj', component: '' },
          SCOPE_CLUSTER,
        ),
      ).toBe('');
    });

    it('returns empty when component is set without a project', () => {
      expect(
        buildScopePath(
          { namespace: 'default', project: '', component: 'api' },
          SCOPE_CLUSTER,
        ),
      ).toBe('');
    });
  });

  describe('namespace bindings', () => {
    it('uses the provided namespace and wildcards everything else when nothing is set', () => {
      expect(
        buildScopePath(
          { namespace: '', project: '', component: '' },
          SCOPE_NAMESPACE,
          'team-a',
        ),
      ).toBe('ns:team-a/*');
    });

    it('falls back to wildcard when no namespace is provided', () => {
      expect(
        buildScopePath(
          { namespace: '', project: '', component: '' },
          SCOPE_NAMESPACE,
        ),
      ).toBe('ns:*/*');
    });

    it('appends project with wildcard component', () => {
      expect(
        buildScopePath(
          { namespace: '', project: 'myproj', component: '' },
          SCOPE_NAMESPACE,
          'team-a',
        ),
      ).toBe('ns:team-a/proj:myproj/*');
    });

    it('appends full project/component path', () => {
      expect(
        buildScopePath(
          { namespace: '', project: 'myproj', component: 'api' },
          SCOPE_NAMESPACE,
          'team-a',
        ),
      ).toBe('ns:team-a/proj:myproj/comp:api');
    });

    it('returns empty when component is set without a project', () => {
      expect(
        buildScopePath(
          { namespace: '', project: '', component: 'api' },
          SCOPE_NAMESPACE,
          'team-a',
        ),
      ).toBe('');
    });

    it('returns empty when project is set but no namespace is provided', () => {
      expect(
        buildScopePath(
          { namespace: '', project: 'myproj', component: '' },
          SCOPE_NAMESPACE,
        ),
      ).toBe('');
    });
  });
});

describe('toK8sName', () => {
  it('lowercases the input', () => {
    expect(toK8sName('MyBinding')).toBe('mybinding');
  });

  it('replaces non-alphanumeric with hyphens', () => {
    expect(toK8sName('user@example.com')).toBe('user-example-com');
  });

  it('collapses consecutive hyphens', () => {
    expect(toK8sName('a---b')).toBe('a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(toK8sName('---hello---')).toBe('hello');
  });

  it('truncates to 63 characters', () => {
    const long = 'a'.repeat(100);
    expect(toK8sName(long)).toHaveLength(63);
  });

  it('does not end with a hyphen after truncation', () => {
    const input = `${'a'.repeat(62)}-something`;
    const result = toK8sName(input);
    expect(result.endsWith('-')).toBe(false);
  });

  it('returns empty string when nothing valid remains', () => {
    expect(toK8sName('!!!')).toBe('');
  });
});

describe('getK8sNameError', () => {
  it('returns an error when empty', () => {
    expect(getK8sNameError('')).toBe('Name is required');
  });

  it('returns an error when only whitespace', () => {
    expect(getK8sNameError('   ')).toBe('Name is required');
  });

  it('returns an error when longer than 63 characters', () => {
    expect(getK8sNameError('a'.repeat(64))).toBe(
      'Must be 63 characters or less',
    );
  });

  it('returns an error when starting with a hyphen', () => {
    expect(getK8sNameError('-name')).toBe(
      'Must start with a lowercase letter or number',
    );
  });

  it('returns an error when ending with a hyphen', () => {
    expect(getK8sNameError('name-')).toBe(
      'Must end with a lowercase letter or number',
    );
  });

  it('returns an error when containing uppercase letters', () => {
    expect(getK8sNameError('Name')).toBe(
      'Must start with a lowercase letter or number',
    );
  });

  it('returns an error when containing illegal characters', () => {
    expect(getK8sNameError('na_me')).toBe(
      'Only lowercase letters, numbers, and hyphens are allowed',
    );
  });

  it('returns null for valid names', () => {
    expect(getK8sNameError('my-binding-1')).toBeNull();
    expect(getK8sNameError('a')).toBeNull();
    expect(getK8sNameError('1')).toBeNull();
    expect(getK8sNameError('a'.repeat(63))).toBeNull();
  });
});
