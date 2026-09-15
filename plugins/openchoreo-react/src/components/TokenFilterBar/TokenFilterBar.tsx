import {
  ReactNode,
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDebounce } from 'react-use';
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  PaperProps,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import { Autocomplete } from '@material-ui/lab';
import SearchIcon from '@material-ui/icons/Search';
import { useTokenFilterBarStyles } from './styles';
import {
  FilterFieldDef,
  FilterToken,
  FilterValuesProvider,
  FilterValuesState,
} from './types';

/** How long the user stops typing before a value list is asked for. */
const VALUE_SEARCH_DEBOUNCE_MS = 300;

/** Room kept for the caret and its placeholder, and for the clear button. */
const CHIP_ROW_RESERVE = 150;

/** Width the `+N` count occupies once there is an overflow to report. */
const OVERFLOW_CHIP_WIDTH = 52;

/**
 * How a query is combined. Shown whatever the field's state, because it is the
 * one thing a reader cannot infer from the chips in front of them.
 */
const COMBINING_RULE =
  'Values on one field are OR-ed; different fields are AND-ed.';

const EMPTY_VALUES: FilterValuesState['values'] = [];

const IDLE_VALUES: FilterValuesState = { values: EMPTY_VALUES };

/** Stands in when a caller offers no value lists, so the call site is stable. */
const useNoValues = (): FilterValuesState => IDLE_VALUES;

const tokenKey = (token: FilterToken): string =>
  `${token.path ?? 'text'}:${token.value}`;

interface PopoverFrame {
  header: string;
  loading: boolean;
  footer?: ReactNode;
}

const PopoverFrameContext = createContext<PopoverFrame>({
  header: '',
  loading: false,
});

/**
 * The listbox's header and footnote.
 *
 * A module-level component reading its content from context, rather than one
 * closed over the current render: `PaperComponent` is remounted whenever its
 * identity changes, and the header changes on every loading flip — which tore
 * the list down mid-type, losing its scroll position.
 */
const FramedPopoverPaper = ({ children, ...paperProps }: PaperProps) => {
  const classes = useTokenFilterBarStyles();
  const { header, loading, footer } = useContext(PopoverFrameContext);

  return (
    <Paper {...paperProps} className={classes.popover}>
      <Box className={classes.popoverHeader}>
        <SearchIcon fontSize="small" color="disabled" />
        <Typography variant="caption" color="textSecondary">
          {header}
        </Typography>
        {loading && <CircularProgress size={14} />}
      </Box>
      {children}
      {footer && (
        <Box className={classes.popoverFooter}>
          <Typography variant="caption">{footer}</Typography>
        </Box>
      )}
    </Paper>
  );
};

/**
 * Last path segment to its full path, where that segment names exactly one
 * field — so `project:` resolves to `resource.project`. Segments two fields
 * share are deliberately absent: guessing one would silently filter the wrong
 * field.
 */
export function buildPathAliases(paths: string[]): Map<string, string> {
  const bySegment = new Map<string, string[]>();
  for (const path of paths) {
    // Keyed lowercase, valued canonical: typing is matched case-insensitively,
    // but the query carries the caller's spelling.
    const segment = (path.split('.').pop() as string).toLowerCase();
    const existing = bySegment.get(segment);
    if (existing) existing.push(path);
    else bySegment.set(segment, [path]);
  }

  const aliases = new Map<string, string>();
  for (const [segment, matches] of bySegment) {
    if (matches.length === 1 && matches[0].toLowerCase() !== segment) {
      aliases.set(segment, matches[0]);
    }
  }
  return aliases;
}

export function resolvePath(
  key: string,
  paths: string[],
  aliases: Map<string, string>,
): string | null {
  const normalized = key.trim().toLowerCase();
  const match = paths.find(path => path.toLowerCase() === normalized);
  if (match) return match;
  return aliases.get(normalized) ?? null;
}

/** Splits `actor.id:ali` into the field and the text typed against it. */
export function parseFilterDraft(
  draft: string,
  paths: string[],
  aliases: Map<string, string>,
): { path: string | null; query: string } {
  const separator = draft.indexOf(':');
  if (separator < 0) return { path: null, query: draft.trim() };
  const path = resolvePath(draft.slice(0, separator), paths, aliases);
  if (!path) return { path: null, query: draft.trim() };
  return { path, query: draft.slice(separator + 1).trim() };
}

/**
 * What the field holds and what it offers. Applied filters and suggestions
 * share one type because `Autocomplete` draws both from the same generic.
 */
type BarOption =
  | { kind: 'token'; token: FilterToken }
  | { kind: 'path'; path: string }
  | { kind: 'value'; path: string; value: string; count?: number }
  | { kind: 'free'; value: string };

function optionLabel(option: BarOption): string {
  switch (option.kind) {
    case 'token':
      return `${option.token.path ?? 'text'}: ${option.token.value}`;
    case 'path':
      return option.path;
    default:
      return option.value;
  }
}

function optionKey(option: BarOption): string {
  switch (option.kind) {
    case 'token':
      return `token:${option.token.path ?? 'text'}:${option.token.value}`;
    case 'path':
      return `path:${option.path}`;
    case 'value':
      return `value:${option.path}:${option.value}`;
    default:
      return `free:${option.value}`;
  }
}

export interface TokenFilterBarProps {
  /** The filters currently applied. */
  tokens: FilterToken[];
  /** The vocabulary this view offers, in the order it should be listed. */
  fields: FilterFieldDef[];
  onToggleToken: (path: string | null, value: string) => void;
  onRemoveToken: (path: string | null, value: string) => void;
  onClear: () => void;
  /**
   * Supplies the values a field takes. Omit it for a bar with no value lists,
   * where every filter is typed exactly.
   */
  useValues?: FilterValuesProvider;
  /**
   * Whether a field can carry a typed value. A field whose values are a closed
   * set refuses anything outside it, so offering one would build a filter the
   * query cannot express. Open-valued fields take anything, which is the
   * default when this is omitted.
   */
  isValueAllowed?: (path: string, value: string) => boolean;
  /**
   * The field names the empty-state hint offers as examples, as one phrase.
   * Defaults to the first four of `fields`, which is rarely the best four.
   */
  exampleFields?: string;
  /** Sits on the field's border, as on the controls beside it. */
  label?: string;
  /** Whether free text is a filter of its own. */
  allowFreeText?: boolean;
  /** What free text becomes, for the hint that explains it. */
  freeTextNote?: string;
  placeholder?: string;
  emptyPlaceholder?: string;
  ariaLabel?: string;
  /** Appended to the hint line — a note about how the values are counted. */
  valuesFootnote?: ReactNode;
  disabled?: boolean;
}

/**
 * A query bar where a filter is a field and a value: the user types the field
 * name and picks from the values it actually takes.
 *
 * The vocabulary and the values are both the caller's. Fields are named as the
 * query sends them, so a chip reads as the filter it becomes and there is no
 * renaming layer between what is picked and what is requested; values arrive
 * through {@link FilterValuesProvider}, which keeps this component free of any
 * one API.
 */
export const TokenFilterBar = ({
  tokens,
  fields,
  onToggleToken,
  onRemoveToken,
  onClear,
  useValues,
  isValueAllowed,
  exampleFields,
  label,
  allowFreeText = true,
  freeTextNote,
  placeholder = 'Add a filter',
  emptyPlaceholder = 'Filter records',
  ariaLabel = 'Filter records',
  valuesFootnote,
  disabled = false,
}: TokenFilterBarProps) => {
  const classes = useTokenFilterBarStyles();
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipNodes = useRef(new Map<string, HTMLDivElement>());
  const chipWidths = useRef(new Map<string, number>());
  const [, remeasured] = useState({});
  const [fieldWidth, setFieldWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const paths = useMemo(() => fields.map(field => field.path), [fields]);
  const aliases = useMemo(() => buildPathAliases(paths), [paths]);
  const byPath = useMemo(
    () => new Map(fields.map(field => [field.path, field])),
    [fields],
  );

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return undefined;
    setFieldWidth(field.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setFieldWidth(entry.contentRect.width),
    );
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  // A width measured against a fallback font, or against the previous theme,
  // describes a chip that no longer exists. Both are one-off events, so the
  // cache is dropped and the chips measured again.
  const theme = useTheme();
  useLayoutEffect(() => {
    chipWidths.current.clear();
    remeasured({});
  }, [theme]);

  useLayoutEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (cancelled) return;
      chipWidths.current.clear();
      remeasured({});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Widths come from the chips themselves, recorded the render they are all on
  // screen. Measuring a hidden copy of each chip instead would put every label
  // in the document twice.
  useLayoutEffect(() => {
    const live = new Set(tokens.map(tokenKey));
    // Dropped with their tokens: a long session otherwise accumulates a width
    // for every value ever filtered on.
    for (const key of chipWidths.current.keys()) {
      if (!live.has(key)) chipWidths.current.delete(key);
    }

    let learned = false;
    for (const token of tokens) {
      const key = tokenKey(token);
      const node = chipNodes.current.get(key);
      if (!node || chipWidths.current.has(key)) continue;
      // Margins included: the row has to fit the chip plus its gaps, and
      // `getBoundingClientRect` reports only the chip.
      const style = getComputedStyle(node);
      const margins =
        (parseFloat(style.marginLeft) || 0) +
        (parseFloat(style.marginRight) || 0);
      chipWidths.current.set(
        key,
        Math.ceil(node.getBoundingClientRect().width + margins),
      );
      learned = true;
    }
    // Before paint, so the row is only ever seen at its settled length.
    if (learned) remeasured({});
    // Only the token set can bring an unmeasured chip. A resize recomputes the
    // fit from these widths without needing to measure again.
  }, [tokens]);

  const { path, query } = parseFilterDraft(draft, paths, aliases);

  useDebounce(() => setDebouncedQuery(query), VALUE_SEARCH_DEBOUNCE_MS, [
    query,
  ]);

  const pickable = path !== null && byPath.get(path)?.pickable !== false;

  // Called unconditionally: the provider is a hook, so whether it runs must not
  // depend on a prop. A bar with no value lists gets the idle one instead.
  const useProvidedValues = useValues ?? useNoValues;
  const state = useProvidedValues({
    path,
    query: debouncedQuery,
    enabled: open && pickable && !disabled,
  });

  // A provider may share its cache with other views, or hold the previous
  // field's list across a switch. Either would render another field's values
  // as this one's, so a list is only shown once it is known to be this field's.
  const showingCurrentField = pickable && !state.stale;
  const values = showingCurrentField ? state.values : EMPTY_VALUES;
  const totalValues = showingCurrentField ? state.totalValues ?? 0 : 0;
  const awaitingValues = pickable && Boolean(state.stale);

  // A value the field cannot carry: offering it would spend a click on a filter
  // that goes nowhere, so it is refused where the reader can see why.
  const refusedValue =
    path !== null &&
    Boolean(query) &&
    isValueAllowed !== undefined &&
    !isValueAllowed(path, query);

  const options = useMemo<BarOption[]>(() => {
    if (path === null) {
      const needle = query.toLowerCase();
      const matches = fields
        .filter(
          field =>
            !needle ||
            field.path.toLowerCase().includes(needle) ||
            field.description.toLowerCase().includes(needle),
        )
        .map<BarOption>(field => ({ kind: 'path', path: field.path }));

      return query && allowFreeText
        ? [{ kind: 'free', value: query }, ...matches]
        : matches;
    }

    const rows: BarOption[] = [];
    // A typed value the list does not offer is still filterable — the only way
    // to use a near-unique field, and the fallback when a source serves records
    // but no aggregation.
    if (
      query &&
      !refusedValue &&
      !values.some(value => value.value === query)
    ) {
      rows.push({ kind: 'value', path, value: query });
    }
    for (const value of values) {
      rows.push({
        kind: 'value',
        path,
        value: value.value,
        count: value.count,
      });
    }
    return rows;
  }, [allowFreeText, fields, path, query, refusedValue, values]);

  const selected = useMemo<BarOption[]>(
    () => tokens.map(token => ({ kind: 'token', token })),
    [tokens],
  );

  const handleChange = (_event: unknown, next: BarOption[], reason: string) => {
    if (reason === 'clear') {
      onClear();
      setDraft('');
      setOpen(false);
      return;
    }

    if (reason === 'remove-option') {
      const kept = new Set(
        next.filter(option => option.kind === 'token').map(optionKey),
      );
      const removed = selected.find(option => !kept.has(optionKey(option)));
      if (removed?.kind === 'token') {
        onRemoveToken(removed.token.path, removed.token.value);
      }
      return;
    }

    const added = next[next.length - 1];
    if (!added) return;

    // Picking a field only half-writes the filter: it leaves `field:` in the
    // box for the value, rather than becoming a filter of its own.
    if (added.kind === 'path') {
      setDraft(`${added.path}:`);
      return;
    }
    if (added.kind === 'value') onToggleToken(added.path, added.value);
    else if (added.kind === 'free') onToggleToken(null, added.value);
    setDraft('');
    setDebouncedQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const listHeader =
    path === null
      ? 'Fields you can filter on'
      : `Values of ${path} in this window`;

  const showFootnote = Boolean(valuesFootnote) && path !== null;

  const frame = useMemo<PopoverFrame>(
    () => ({
      header: listHeader,
      loading: Boolean(state.loading),
      footer: showFootnote ? valuesFootnote : undefined,
    }),
    [listHeader, showFootnote, state.loading, valuesFootnote],
  );

  const hint = (() => {
    if (refusedValue) {
      return `${path} does not take "${query}". Pick one of the values it does.`;
    }
    if (path !== null && !pickable) {
      return `${path} has no list to pick from. Paste the exact value you have.`;
    }
    if (path !== null && state.unsupported) {
      return `This deployment cannot list values for ${path}. Type an exact value instead.`;
    }
    if (path !== null && totalValues > values.length) {
      return `Showing ${values.length} of ${totalValues} values. Keep typing to narrow them.`;
    }
    if (tokens.length > 0) return COMBINING_RULE;
    const names =
      exampleFields ??
      fields
        .slice(0, 4)
        .map(field => field.path.split('.').pop())
        .join(', ');
    return `Type a field name (${names}) then pick a value. ${COMBINING_RULE}`;
  })();

  // How many whole chips the row holds, from their measured widths rather than
  // an assumed one — `result: rest` and an issuer URL are nothing alike. Every
  // chip shown is shown in full; the rest become a `+N`.
  const visibleCount = (() => {
    if (focused || tokens.length === 0) return tokens.length;
    // Any token whose width is not known yet is rendered so it can be measured;
    // the effect above then re-runs this with a full set.
    const widths = tokens.map(token => chipWidths.current.get(tokenKey(token)));
    if (!fieldWidth || widths.some(width => width === undefined)) {
      return tokens.length;
    }
    const available = fieldWidth - CHIP_ROW_RESERVE;
    let used = 0;
    let fits = 0;
    for (let index = 0; index < widths.length; index++) {
      const next = used + (widths[index] as number);
      const hasMore = index < widths.length - 1;
      if (next + (hasMore ? OVERFLOW_CHIP_WIDTH : 0) > available) break;
      used = next;
      fits++;
    }
    // A field too narrow for even one chip still shows one rather than a bare
    // `+N`, which would say nothing at all.
    return Math.max(1, fits);
  })();

  const hiddenCount = tokens.length - visibleCount;

  const chipLabel = (option: BarOption) =>
    option.kind === 'token' ? (
      <span className={classes.chipLabel}>
        <span className={classes.chipPath}>{option.token.path ?? 'text'}</span>
        <span className={classes.chipSeparator}>:</span>
        <span className={classes.chipValue}>{option.token.value}</span>
      </span>
    ) : (
      optionLabel(option)
    );

  return (
    <Box className={classes.root}>
      <PopoverFrameContext.Provider value={frame}>
        <Autocomplete<BarOption, true, false, false>
          ref={fieldRef}
          multiple
          autoHighlight
          disableCloseOnSelect
          size="small"
          disabled={disabled}
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          options={options}
          value={selected}
          onChange={handleChange}
          inputValue={draft}
          onInputChange={(_event, value, reason) => {
            if (reason === 'input') setDraft(value);
          }}
          // The options are already narrowed against the draft, which for a value
          // list means narrowed by the source rather than by substring.
          filterOptions={identity => identity}
          getOptionLabel={optionLabel}
          getOptionSelected={(option, value) =>
            optionKey(option) === optionKey(value)
          }
          noOptionsText={
            state.loading || awaitingValues
              ? 'Looking up values…'
              : 'No matching values'
          }
          clearText="Clear all filters"
          closeText="Close"
          openText="Open"
          forcePopupIcon={false}
          classes={{
            clearIndicator:
              tokens.length > 0
                ? `${classes.clearAll} ${classes.clearAllShown}`
                : classes.clearAll,
            endAdornment: classes.endAdornment,
            inputRoot: classes.inputRoot,
            tag: classes.chip,
            option: classes.option,
          }}
          PaperComponent={FramedPopoverPaper}
          renderTags={(value, getTagProps) => [
            ...value.slice(0, visibleCount).map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={optionKey(option)}
                ref={(element: HTMLDivElement | null) => {
                  if (option.kind !== 'token') return;
                  const key = tokenKey(option.token);
                  if (element) chipNodes.current.set(key, element);
                  else chipNodes.current.delete(key);
                }}
                size="small"
                className={classes.chip}
                label={chipLabel(option)}
              />
            )),
            ...(hiddenCount > 0
              ? [
                  <Tooltip
                    key="overflow"
                    title={tokens
                      .slice(visibleCount)
                      .map(token => `${token.path ?? 'text'}: ${token.value}`)
                      .join(', ')}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      className={classes.chip}
                      label={`+${hiddenCount}`}
                      aria-label={`Show ${hiddenCount} more ${
                        hiddenCount === 1 ? 'filter' : 'filters'
                      }`}
                    />
                  </Tooltip>,
                ]
              : []),
          ]}
          renderOption={option => {
            if (option.kind === 'path') {
              return (
                <Box className={classes.optionRow}>
                  <span className={classes.optionPath}>{option.path}</span>
                  <span className={classes.optionDesc}>
                    {byPath.get(option.path)?.description}
                  </span>
                </Box>
              );
            }
            if (option.kind === 'free') {
              return (
                <Box className={classes.optionRow}>
                  <span>Match “{option.value}” anywhere in the record</span>
                  {freeTextNote && (
                    <span className={classes.optionDesc}>{freeTextNote}</span>
                  )}
                </Box>
              );
            }
            if (option.kind !== 'value') return null;
            return (
              <Box className={classes.optionValueRow}>
                <span className={classes.optionValue}>{option.value}</span>
                {option.count === undefined ? (
                  <span className={classes.optionDesc}>
                    use this exact value
                  </span>
                ) : (
                  <span className={classes.optionCount}>
                    {option.count.toLocaleString()}
                  </span>
                )}
              </Box>
            );
          }}
          renderInput={params => (
            <TextField
              {...params}
              variant="outlined"
              label={label}
              // Always up: the field holds chips and a placeholder even when
              // empty, so a label that floated down would sit on top of them.
              InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              placeholder={tokens.length === 0 ? emptyPlaceholder : placeholder}
              inputRef={inputRef}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              inputProps={{ ...params.inputProps, 'aria-label': ariaLabel }}
            />
          )}
        />
      </PopoverFrameContext.Provider>

      <Typography variant="caption" className={classes.hint}>
        {hint}
      </Typography>
    </Box>
  );
};
