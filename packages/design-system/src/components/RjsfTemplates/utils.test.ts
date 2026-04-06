import { humanizeTitle } from './utils';

describe('humanizeTitle', () => {
  it('returns empty string for empty input', () => {
    expect(humanizeTitle('')).toBe('');
  });

  it('returns non-camelCase strings as-is', () => {
    expect(humanizeTitle('Already Title')).toBe('Already Title');
    expect(humanizeTitle('with-dashes')).toBe('with-dashes');
    expect(humanizeTitle('ALLCAPS')).toBe('ALLCAPS');
  });

  it('converts simple camelCase to title case', () => {
    expect(humanizeTitle('myField')).toBe('My Field');
    expect(humanizeTitle('firstName')).toBe('First Name');
  });

  it('handles numbers in camelCase', () => {
    expect(humanizeTitle('field2Name')).toBe('Field 2Name');
  });

  it('handles single word', () => {
    expect(humanizeTitle('name')).toBe('Name');
  });
});
