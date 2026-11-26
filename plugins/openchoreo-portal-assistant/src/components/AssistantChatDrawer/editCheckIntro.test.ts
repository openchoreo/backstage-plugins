import { editCheckIntro, ruleLines } from './editCheckIntro';

const retrievers = [
  {
    id: 'githubRepositoryFactRetriever',
    facts: [
      {
        name: 'githubRequiredApprovingReviewCount',
        type: 'integer',
        description: 'Approving reviews required: on the default branch',
      },
      {
        name: 'githubDefaultBranchProtected',
        type: 'boolean',
        description:
          'Whether the default branch has a branch protection rule that applies to it',
      },
    ],
  },
];

type Component = { id: string; component: string; [key: string]: unknown };
const componentsOf = (messages: unknown[]) =>
  (messages[0] as { createSurface: { components: Component[] } }).createSurface
    .components;
const rootOf = (messages: unknown[]) => componentsOf(messages)[0];

describe('ruleLines', () => {
  it('reads a flat rule in plain words, with labels from the fact schemas', () => {
    const rule = {
      all: [
        {
          fact: 'githubRequiredApprovingReviewCount',
          operator: 'greaterThanInclusive',
          value: 2,
        },
        {
          fact: 'githubDefaultBranchProtected',
          operator: 'equal',
          value: true,
        },
        {
          fact: 'githubVisibility',
          operator: 'in',
          value: ['private', 'internal'],
        },
      ],
    };

    expect(ruleLines(JSON.stringify(rule), retrievers)).toEqual([
      ['Approving reviews required', '2 or more'],
      // Description too long for a label: the fact name in words.
      ['Default branch protected', 'Yes'],
      ['Visibility', 'one of private, internal'],
    ]);
  });

  it('accepts the rule with its "conditions" wrapper', () => {
    const rule = {
      conditions: {
        any: [{ fact: 'githubIsArchived', operator: 'equal', value: false }],
      },
    };
    expect(ruleLines(JSON.stringify(rule), [])).toEqual([
      ['Is archived', 'No'],
    ]);
  });

  it.each([
    [
      'nested groups',
      { all: [{ any: [{ fact: 'a', operator: 'equal', value: 1 }] }] },
    ],
    [
      'an "any" of several',
      {
        any: [
          { fact: 'a', operator: 'equal', value: 1 },
          { fact: 'b', operator: 'equal', value: 2 },
        ],
      },
    ],
    [
      'the same fact twice',
      {
        all: [
          { fact: 'a', operator: 'greaterThan', value: 1 },
          { fact: 'a', operator: 'lessThan', value: 5 },
        ],
      },
    ],
    [
      'a value read through a path',
      {
        all: [
          {
            fact: 'githubTopics',
            path: '$.length',
            operator: 'greaterThan',
            value: 0,
          },
        ],
      },
    ],
  ])('gives nothing for %s', (_, rule) => {
    expect(ruleLines(JSON.stringify(rule), [])).toBeNull();
  });

  it('gives nothing for a missing or broken rule', () => {
    expect(ruleLines(undefined, [])).toBeNull();
    expect(ruleLines('{not json', [])).toBeNull();
  });
});

describe('editCheckIntro', () => {
  it('introduces an edited check with its rule and two questions', () => {
    const messages = editCheckIntro({
      caseType: 'check_authoring',
      checkId: 'abc-123',
      checkName: 'Branch protected',
      currentRule: JSON.stringify({
        all: [
          { fact: 'githubBranchProtected', operator: 'equal', value: true },
        ],
      }),
    });
    const root = rootOf(messages);

    expect(root).toMatchObject({
      component: 'ReplyCard',
      title: 'Edit this check',
      subtitle: 'Branch protected',
    });
    expect(
      componentsOf(messages)
        .filter(c => c.component === 'PickRow')
        .map(c => c.label),
    ).toEqual(['Explain this rule']);
    expect(
      componentsOf(messages).find(c => c.component === 'AskField'),
    ).toMatchObject({
      button: 'Describe your change',
      placeholder:
        'Describe the change you want, for example: require 3 approving reviews',
    });
  });

  it('introduces an edited check without a rule section when the rule is nested', () => {
    const messages = editCheckIntro({
      caseType: 'check_authoring',
      checkId: 'abc-123',
      checkName: 'Nested check',
      currentRule: JSON.stringify({
        all: [{ any: [{ fact: 'a', operator: 'equal', value: 1 }] }],
      }),
    });
    const root = rootOf(messages);

    expect(root).toMatchObject({
      title: 'Edit this check',
      subtitle: 'Nested check',
      sections: [],
      summary:
        "I'll show you any change before it's saved. What would you like to do?",
    });
    expect(
      componentsOf(messages).some(c => c.component === 'ReplySection'),
    ).toBe(false);
  });
});
