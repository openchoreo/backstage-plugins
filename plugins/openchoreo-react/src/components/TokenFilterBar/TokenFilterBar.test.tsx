import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TokenFilterBar,
  buildPathAliases,
  resolvePath,
} from './TokenFilterBar';
import { FilterFieldDef, FilterToken } from './types';

const fields: FilterFieldDef[] = [
  { path: 'result', description: 'How the action ended' },
  { path: 'actor.id', description: 'Who acted', pickable: false },
  { path: 'resource.project', description: 'The project it happened in' },
];

const tokens: FilterToken[] = [
  { path: 'result', value: 'denied' },
  { path: 'result', value: 'failure' },
  { path: 'actor.id', value: 'alice@example.com' },
  { path: null, value: 'occ' },
];

const defaults = {
  fields,
  onToggleToken: jest.fn(),
  onRemoveToken: jest.fn(),
  onClear: jest.fn(),
};

/**
 * jsdom lays nothing out, so every box measures zero and the bar concludes that
 * every chip fits. These give it a field and chips of a known size: 800 wide,
 * less the 150 reserved for the caret, holds two 200px chips plus the `+N`.
 */
function withLayout(fieldWidth = 800, chipWidth = 200) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: fieldWidth,
  });
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width: chipWidth, height: 24 } as DOMRect);
}

describe('TokenFilterBar', () => {
  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  });

  it('shows only the filters that fit, with a count for the rest', () => {
    withLayout();
    render(<TokenFilterBar {...defaults} tokens={tokens} />);

    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(screen.getByText('failure')).toBeInTheDocument();
    // Beyond the limit the query is a count, so the field stays one line.
    expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('shows every filter once the field is focused', async () => {
    render(<TokenFilterBar {...defaults} tokens={tokens} />);

    await userEvent.click(screen.getByRole('textbox'));

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('occ')).toBeInTheDocument();
    expect(screen.queryByText('+2')).not.toBeInTheDocument();
  });

  it('names the field a chip filters on, not just its value', () => {
    render(<TokenFilterBar {...defaults} tokens={[tokens[0]]} />);

    const chip = screen.getByText('denied').closest('.MuiChip-root');
    expect(chip).toHaveTextContent('result');
    expect(chip).toHaveTextContent(':');
    expect(chip).toHaveTextContent('denied');
  });

  it('keeps a lone chip deletable', () => {
    const onRemoveToken = jest.fn();
    render(
      <TokenFilterBar
        {...defaults}
        tokens={[tokens[0]]}
        onRemoveToken={onRemoveToken}
      />,
    );

    const chip = screen.getByText('denied').closest('.MuiChip-root');
    const remove = chip?.querySelector('.MuiChip-deleteIcon');
    expect(remove).toBeInTheDocument();

    userEvent.click(remove as Element);
    return waitFor(() =>
      expect(onRemoveToken).toHaveBeenCalledWith('result', 'denied'),
    );
  });

  // Queried by title rather than by role: the clear button is made visible by
  // overriding a `visibility: hidden` rule, and jsdom does not resolve that
  // cascade, so a role query treats it as hidden.
  const clearAll = () => screen.getByTitle('Clear all filters');

  it('offers one clear-all beside the per-chip deletes', async () => {
    const onClear = jest.fn();
    render(<TokenFilterBar {...defaults} tokens={tokens} onClear={onClear} />);

    await userEvent.click(clearAll());

    expect(onClear).toHaveBeenCalled();
  });

  it('clears without opening the suggestion list over the emptied field', async () => {
    const onClear = jest.fn();
    render(<TokenFilterBar {...defaults} tokens={tokens} onClear={onClear} />);

    await userEvent.click(clearAll());

    expect(onClear).toHaveBeenCalled();
    expect(
      screen.queryByText('Fields you can filter on'),
    ).not.toBeInTheDocument();
  });

  it('lays the chips out inside the field', () => {
    render(<TokenFilterBar {...defaults} tokens={tokens} />);

    const root = screen.getByRole('textbox').closest('.MuiInputBase-root');
    const chip = screen.getByText('denied').closest('.MuiChip-root');

    expect(root).toContainElement(chip as HTMLElement);
  });

  it('leaves a short query whole rather than counting it', () => {
    render(<TokenFilterBar {...defaults} tokens={tokens.slice(0, 2)} />);

    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(screen.getByText('failure')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('opens the overflow by focusing the field it belongs to', async () => {
    withLayout();
    render(<TokenFilterBar {...defaults} tokens={tokens} />);

    await userEvent.click(screen.getByText('+2'));

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('offers the caller vocabulary rather than any built-in field list', async () => {
    render(<TokenFilterBar {...defaults} tokens={[]} />);

    await userEvent.click(screen.getByRole('textbox'));

    expect(screen.getByText('resource.project')).toBeInTheDocument();
    expect(screen.getByText('The project it happened in')).toBeInTheDocument();
  });

  it('asks the provider for values only while a pickable field is open', async () => {
    const useValues = jest.fn().mockReturnValue({ values: [] });
    render(<TokenFilterBar {...defaults} tokens={[]} useValues={useValues} />);

    // Rendered but idle: nothing is open, so nothing should be requested.
    expect(useValues).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'result:');

    expect(useValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'result', enabled: true }),
    );
  });

  it('does not show one field values as another field', async () => {
    const useValues = jest.fn().mockReturnValue({
      values: [{ value: 'from-another-field', count: 3 }],
      stale: true,
    });
    render(<TokenFilterBar {...defaults} tokens={[]} useValues={useValues} />);

    await userEvent.type(screen.getByRole('textbox'), 'result:');

    expect(screen.queryByText('from-another-field')).not.toBeInTheDocument();
    expect(screen.getByText('Looking up values…')).toBeInTheDocument();
  });

  it('says a near-unique field has no list to pick from', async () => {
    render(<TokenFilterBar {...defaults} tokens={[]} />);

    await userEvent.type(screen.getByRole('textbox'), 'actor.id:');

    expect(screen.getByText(/no list to pick from/)).toBeInTheDocument();
  });

  it('refuses a typed value the field cannot carry, and says so', async () => {
    const onToggleToken = jest.fn();
    render(
      <TokenFilterBar
        {...defaults}
        tokens={[]}
        onToggleToken={onToggleToken}
        isValueAllowed={(path, value) =>
          path !== 'result' || value === 'denied'
        }
      />,
    );

    await userEvent.type(screen.getByRole('textbox'), 'result:granted');

    expect(screen.queryByText('granted')).not.toBeInTheDocument();
    expect(screen.getByText(/does not take "granted"/)).toBeInTheDocument();
  });

  it('still takes a typed value on a field with no closed set', async () => {
    const onToggleToken = jest.fn();
    render(
      <TokenFilterBar
        {...defaults}
        tokens={[]}
        onToggleToken={onToggleToken}
        isValueAllowed={path => path !== 'result'}
      />,
    );

    await userEvent.type(screen.getByRole('textbox'), 'actor.id:alice@x.dev');
    await userEvent.click(screen.getByText('alice@x.dev'));

    expect(onToggleToken).toHaveBeenCalledWith('actor.id', 'alice@x.dev');
  });

  it('lets go of the field once a value is picked', async () => {
    const onToggleToken = jest.fn();
    const useValues = jest.fn().mockReturnValue({
      values: [{ value: 'denied', count: 3 }],
    });
    render(
      <TokenFilterBar
        {...defaults}
        tokens={[]}
        onToggleToken={onToggleToken}
        useValues={useValues}
      />,
    );

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'result:');
    await userEvent.click(screen.getByText('denied'));

    expect(onToggleToken).toHaveBeenCalledWith('result', 'denied');
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('lets go of the field once free text is added', async () => {
    const onToggleToken = jest.fn();
    render(
      <TokenFilterBar
        {...defaults}
        tokens={[]}
        onToggleToken={onToggleToken}
        allowFreeText
      />,
    );

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'occ{enter}');

    expect(onToggleToken).toHaveBeenCalledWith(null, 'occ');
    expect(input).not.toHaveFocus();
  });

  it('removes the last filter on backspace in an empty field', async () => {
    const onRemoveToken = jest.fn();
    render(
      <TokenFilterBar
        {...defaults}
        tokens={tokens}
        onRemoveToken={onRemoveToken}
      />,
    );

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{Backspace}');

    expect(onRemoveToken).toHaveBeenCalledWith(null, 'occ');
  });
});

describe('resolvePath', () => {
  const paths = ['result', 'resource.project', 'resource.apiVersion'];
  const aliases = buildPathAliases(paths);

  it('matches a field however it was typed, and answers with the canonical path', () => {
    expect(resolvePath('Result', paths, aliases)).toBe('result');
    expect(resolvePath('resource.apiversion', paths, aliases)).toBe(
      'resource.apiVersion',
    );
    expect(resolvePath('  RESOURCE.PROJECT ', paths, aliases)).toBe(
      'resource.project',
    );
  });

  it('resolves a last segment that names one field', () => {
    expect(resolvePath('project', paths, aliases)).toBe('resource.project');
    expect(resolvePath('apiVersion', paths, aliases)).toBe(
      'resource.apiVersion',
    );
  });

  it('gives nothing for a key that names no field', () => {
    expect(resolvePath('namespace', paths, aliases)).toBeNull();
  });

  it('leaves a segment two fields share unresolved', () => {
    const ambiguous = ['actor.id', 'resource.id'];
    expect(
      resolvePath('id', ambiguous, buildPathAliases(ambiguous)),
    ).toBeNull();
  });
});
