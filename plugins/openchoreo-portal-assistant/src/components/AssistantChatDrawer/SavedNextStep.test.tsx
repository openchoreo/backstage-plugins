import type { SavedCheck } from '../ConfirmCard/ConfirmCard';
import { nextStepWords } from './SavedNextStep';

const saved = (overrides: Partial<SavedCheck>): SavedCheck => ({
  checkId: 'c1',
  kind: 'create',
  name: 'Repo not archived',
  rule: '{}',
  status: 'draft',
  wasPublished: false,
  ...overrides,
});

describe('nextStepWords', () => {
  it.each([
    [{}, 'Saved as a draft', /until you publish it/],
    [{ status: 'published' as const }, 'Published', /includes this check/],
    [
      {
        kind: 'update' as const,
        status: 'published' as const,
        wasPublished: true,
      },
      'Saved, still published',
      /new rule/,
    ],
    // Unpublished by the save: a draft again.
    [
      { kind: 'update' as const, status: 'draft' as const, wasPublished: true },
      'Saved as a draft',
      /until you publish it/,
    ],
  ])('says what the save did (%o)', (overrides, title, text) => {
    const words = nextStepWords(saved(overrides));

    expect(words.title).toBe(title);
    expect(words.text).toMatch(text);
    // Only what the save did: a test is offered before saving, not after.
    expect(words.text).not.toMatch(/\b(try|test)\b/i);
  });
});
