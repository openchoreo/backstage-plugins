import { UserTypeConfig } from '../../hooks';
import {
  WIZARD_STEPS,
  WizardState,
  createInitialWizardState,
  getStepIndex,
  isStepClickable,
  isStepValid,
} from './types';

const userTypes: UserTypeConfig[] = [
  {
    type: 'user',
    displayName: 'User',
    entitlementClaim: 'sub',
  } as unknown as UserTypeConfig,
  {
    type: 'service_account',
    displayName: 'Service Account',
    entitlementClaim: 'sub',
  } as unknown as UserTypeConfig,
];

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    subjectType: 'user',
    entitlementValue: 'platform-team',
    roleMappings: [
      {
        role: 'admin',
        roleNamespace: '',
        namespace: '',
        project: '',
        component: '',
        confirmed: true,
        conditions: [],
      },
    ],
    effect: 'allow',
    name: 'valid-binding-name',
    ...overrides,
  };
}

describe('createInitialWizardState', () => {
  it('seeds subjectType from the first user type', () => {
    const state = createInitialWizardState(userTypes);
    expect(state.subjectType).toBe('user');
  });

  it('falls back to empty subjectType when no user types are provided', () => {
    const state = createInitialWizardState([]);
    expect(state.subjectType).toBe('');
  });

  it('starts with allow effect, no mappings, and empty fields', () => {
    const state = createInitialWizardState(userTypes);
    expect(state.entitlementValue).toBe('');
    expect(state.roleMappings).toEqual([]);
    expect(state.effect).toBe('allow');
    expect(state.name).toBe('');
  });
});

describe('isStepValid', () => {
  describe('subject step', () => {
    it('is valid when subjectType and entitlementValue are set', () => {
      expect(isStepValid('subject', baseState())).toBe(true);
    });

    it('is invalid when subjectType is missing', () => {
      expect(
        isStepValid('subject', baseState({ subjectType: '' })),
      ).toBe(false);
    });

    it('is invalid when entitlementValue is only whitespace', () => {
      expect(
        isStepValid('subject', baseState({ entitlementValue: '   ' })),
      ).toBe(false);
    });
  });

  describe('roleMappings step', () => {
    it('is invalid when there are no mappings', () => {
      expect(
        isStepValid('roleMappings', baseState({ roleMappings: [] })),
      ).toBe(false);
    });

    it('is invalid when a mapping is unconfirmed', () => {
      const state = baseState({
        roleMappings: [
          {
            role: 'admin',
            roleNamespace: '',
            namespace: '',
            project: '',
            component: '',
            confirmed: false,
            conditions: [],
          },
        ],
      });
      expect(isStepValid('roleMappings', state)).toBe(false);
    });

    it('is invalid when a condition is unconfirmed', () => {
      const state = baseState({
        roleMappings: [
          {
            role: 'admin',
            roleNamespace: '',
            namespace: '',
            project: '',
            component: '',
            confirmed: true,
            conditions: [
              {
                id: 'c1',
                actions: ['read'],
                expression: 'true',
                confirmed: false,
              },
            ],
          },
        ],
      });
      expect(isStepValid('roleMappings', state)).toBe(false);
    });

    it('is invalid when a confirmed condition is missing actions', () => {
      const state = baseState({
        roleMappings: [
          {
            role: 'admin',
            roleNamespace: '',
            namespace: '',
            project: '',
            component: '',
            confirmed: true,
            conditions: [
              {
                id: 'c1',
                actions: [],
                expression: 'true',
                confirmed: true,
              },
            ],
          },
        ],
      });
      expect(isStepValid('roleMappings', state)).toBe(false);
    });

    it('is invalid when a confirmed condition has empty expression', () => {
      const state = baseState({
        roleMappings: [
          {
            role: 'admin',
            roleNamespace: '',
            namespace: '',
            project: '',
            component: '',
            confirmed: true,
            conditions: [
              {
                id: 'c1',
                actions: ['read'],
                expression: '   ',
                confirmed: true,
              },
            ],
          },
        ],
      });
      expect(isStepValid('roleMappings', state)).toBe(false);
    });

    it('is valid when all mappings and conditions are confirmed and well-formed', () => {
      const state = baseState({
        roleMappings: [
          {
            role: 'admin',
            roleNamespace: '',
            namespace: '',
            project: '',
            component: '',
            confirmed: true,
            conditions: [
              {
                id: 'c1',
                actions: ['read'],
                expression: 'resource.env == "prod"',
                confirmed: true,
              },
            ],
          },
        ],
      });
      expect(isStepValid('roleMappings', state)).toBe(true);
    });
  });

  describe('effect step', () => {
    it('is valid for allow with a valid name', () => {
      expect(isStepValid('effect', baseState({ effect: 'allow' }))).toBe(true);
    });

    it('is valid for deny with a valid name', () => {
      expect(isStepValid('effect', baseState({ effect: 'deny' }))).toBe(true);
    });

    it('is invalid for an empty name', () => {
      expect(isStepValid('effect', baseState({ name: '' }))).toBe(false);
    });

    it('is invalid for an illegal name', () => {
      expect(isStepValid('effect', baseState({ name: 'Bad_Name' }))).toBe(
        false,
      );
    });
  });

  describe('review step', () => {
    it('is always valid', () => {
      expect(isStepValid('review', baseState())).toBe(true);
    });
  });
});

describe('getStepIndex', () => {
  it('returns the index for each known step', () => {
    expect(getStepIndex('subject')).toBe(0);
    expect(getStepIndex('roleMappings')).toBe(1);
    expect(getStepIndex('effect')).toBe(2);
    expect(getStepIndex('review')).toBe(3);
  });

  it('matches WIZARD_STEPS order', () => {
    WIZARD_STEPS.forEach((step, i) => {
      expect(getStepIndex(step.id)).toBe(i);
    });
  });
});

describe('isStepClickable', () => {
  it('always allows clicking the current step', () => {
    const state = baseState({
      subjectType: '',
      entitlementValue: '',
    });
    expect(isStepClickable('subject', 'subject', state)).toBe(true);
  });

  it('always allows navigating backwards', () => {
    const state = baseState({
      subjectType: '',
      entitlementValue: '',
    });
    expect(isStepClickable('subject', 'effect', state)).toBe(true);
  });

  it('blocks forward navigation when an earlier step is invalid', () => {
    const state = baseState({ subjectType: '' });
    expect(isStepClickable('effect', 'subject', state)).toBe(false);
  });

  it('allows forward navigation when all prior steps are valid', () => {
    const state = baseState();
    expect(isStepClickable('review', 'subject', state)).toBe(true);
  });
});
