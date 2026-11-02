import { useId, useState } from 'react';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import MenuItem from '@material-ui/core/MenuItem';
import Autocomplete from '@material-ui/lab/Autocomplete';
import Alert from '@material-ui/lab/Alert';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import Box from '@material-ui/core/Box';
import Tooltip from '@material-ui/core/Tooltip';
import IconButton from '@material-ui/core/IconButton';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { InfoCard } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { dynamicChecksApiRef } from '../../api/DynamicChecksApi';
import { DEFAULT_CHECK_CATEGORIES } from '../../constants';
import {
  NOT_ALLOWED_TOOLTIP,
  useCheckPermissions,
} from '../useCheckPermissions';
import {
  filterCoversKinds,
  useCatalogKinds,
  useEntityLabel,
  useKindDisplay,
  withArticle,
} from '../../kinds';
import { CHECK_TIERS } from '../../tierPalette';
import { useTierLabel } from '../useTierLabel';
import { useCoveredKindsText } from '../FactCollectorsPanel/CollectorInfoButton';
import { FORMAT_SHORTCUT, SUGGEST_SHORTCUT } from '../JsonEditor/JsonEditor';
import { FilterEditor } from '../JsonEditor/FilterEditor';
import { RuleEditor } from '../JsonEditor/RuleEditor';
import { DryRunEntityField } from './DryRunEntityField';
import { DryRunResultView } from './DryRunResultView';
import {
  type CheckLink,
  type DryRunResult,
  type DynamicCheck,
  type DynamicCheckInput,
  type FactSchema,
} from '../../api/types';

interface CheckFormProps {
  check: DynamicCheck | null;
  factSchemas: FactSchema[];
  existingCategories: string[];
  onSaved: (check: DynamicCheck) => void;
  onPublished: () => void;
  /**
   * Hides the form's own InfoCard title, for a full-page editor that already
   * shows "New check"/"Edit check: <name>" so it isn't repeated.
   */
  showTitle?: boolean;
  /**
   * Renders a Cancel button alongside the save actions when provided.
   * CheckFormDialog relies on its own close button instead.
   */
  onCancel?: () => void;
}

function defaultRuleJson() {
  return JSON.stringify(
    { conditions: { all: [{ fact: '', operator: 'equal', value: true }] } },
    null,
    2,
  );
}

const DEFAULT_KINDS = ['Component'];

type Field =
  | 'name'
  | 'factIds'
  | 'rule'
  | 'filter'
  | 'entityRef'
  | 'links'
  | 'rank';
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_LABELS: Record<Field, string> = {
  name: 'Name',
  factIds: 'Fact retrievers',
  rule: 'Rule',
  filter: 'Additional criteria',
  entityRef: 'Dry-run target',
  links: 'Reference links',
  rank: 'Maturity tier',
};

interface FilterFormState {
  kinds: string[];
  extraJson: string;
  /**
   * True when the stored filter can't be split into kinds plus extra
   * criteria (e.g. an array of filters, which jsonfc ORs together), so it is
   * edited as raw JSON to round-trip unchanged.
   */
  raw: boolean;
}

function isStringOrStringArray(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every(v => typeof v === 'string'))
  );
}

function toFilterFormState(filter: unknown): FilterFormState {
  if (filter === undefined || filter === null) {
    return { kinds: [], extraJson: '', raw: false };
  }
  if (
    typeof filter !== 'object' ||
    Array.isArray(filter) ||
    ('kind' in filter && !isStringOrStringArray(filter.kind))
  ) {
    return { kinds: [], extraJson: JSON.stringify(filter, null, 2), raw: true };
  }
  const { kind, ...rest } = filter as Record<string, unknown>;
  return {
    kinds: kind === undefined ? [] : ([] as string[]).concat(kind as string),
    extraJson:
      Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2) : '',
    raw: false,
  };
}

export function CheckForm(props: CheckFormProps) {
  const {
    check,
    factSchemas,
    existingCategories,
    onSaved,
    onPublished,
    showTitle = true,
    onCancel,
  } = props;
  const api = useApi(dynamicChecksApiRef);
  // Ids tie each label to its input, which MUI only does when given one.
  const idPrefix = useId();
  const fieldId = (field: string) => `${idPrefix}-${field}`;

  const [name, setName] = useState(check?.name ?? '');
  const [description, setDescription] = useState(check?.description ?? '');
  const [category, setCategory] = useState(
    (check?.metadata?.category as string | undefined) ?? '',
  );
  const categoryOptions = Array.from(
    new Set([...DEFAULT_CHECK_CATEGORIES, ...existingCategories]),
  ).sort();
  const [rank, setRank] = useState<string>(
    check?.metadata?.rank !== undefined ? String(check.metadata.rank) : '',
  );
  const [solution, setSolution] = useState(
    typeof check?.metadata?.solution === 'string'
      ? check.metadata.solution
      : '',
  );
  const [links, setLinks] = useState<CheckLink[]>(check?.links ?? []);
  const [factIds, setFactIds] = useState<string[]>(check?.factIds ?? []);
  const [ruleJson, setRuleJson] = useState(
    check ? JSON.stringify(check.rule, null, 2) : defaultRuleJson(),
  );
  const [initialFilter] = useState(() =>
    check
      ? toFilterFormState(check.filter)
      : { kinds: DEFAULT_KINDS, extraJson: '', raw: false },
  );
  const [kinds, setKinds] = useState<string[]>(initialFilter.kinds);
  const [filterJson, setFilterJson] = useState(initialFilter.extraJson);
  const rawFilter = initialFilter.raw;
  const [entityRef, setEntityRef] = useState('');

  const catalogKinds = useCatalogKinds() ?? DEFAULT_KINDS;
  const kindLabel = useKindDisplay();
  const entityLabel = useEntityLabel();
  const tierLabel = useTierLabel();
  // Retrievers keep a schema after they're removed, so only the ones
  // scheduled now are offered; a check keeps any it already uses.
  const { value: scheduledRetrievers } = useAsync(async () => {
    const collectors = await api.listFactCollectors();
    return new Set(collectors.map(collector => collector.id));
  }, [api]);
  const scheduledSchemas = factSchemas.filter(
    schema => scheduledRetrievers?.has(schema.id) ?? true,
  );
  // A check on a kind no retriever collects for never has a result.
  const sortedKindOptions = catalogKinds
    .filter(kind =>
      scheduledSchemas.some(schema =>
        filterCoversKinds(schema.entityFilter, [kind]),
      ),
    )
    .sort((a, b) => kindLabel(a).localeCompare(kindLabel(b)));
  // The picker shows kind labels, so typed text is matched against them as
  // well as the kind itself before it goes into the filter.
  const kindOf = (text: string) => {
    const typed = text.trim().toLocaleLowerCase('en-US');
    return (
      catalogKinds.find(
        kind =>
          kind.toLocaleLowerCase('en-US') === typed ||
          kindLabel(kind).toLocaleLowerCase('en-US') === typed,
      ) ?? text.trim()
    );
  };

  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorsFrom, setErrorsFrom] = useState<'save' | 'dryRun'>('save');
  const clearError = (field: Field) =>
    setErrors(current => {
      if (!current[field]) return current;
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  const [saving, setSaving] = useState(false);
  // Set once a new check is created, so a retry after a failed publish
  // updates that check instead of creating a duplicate.
  const [savedId, setSavedId] = useState<string | undefined>(check?.id);
  const published = check?.status === 'published';
  const { canManage } = useCheckPermissions();
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);

  /**
   * Validates the form and builds the check, or records an error against
   * each field that needs one. The tier and reference links are only needed
   * to save, so a dry run doesn't ask for sections further down the form.
   */
  function buildInput(forSave: boolean): DynamicCheckInput | null {
    const found: FieldErrors = {};
    if (!name.trim()) found.name = 'Give the check a name.';
    if (factIds.length === 0) {
      found.factIds = 'Pick at least one fact retriever.';
    }
    let rule;
    try {
      rule = JSON.parse(ruleJson);
    } catch (e) {
      found.rule = `Not valid JSON: ${(e as Error).message}`;
    }
    let filter;
    let extra;
    if (filterJson.trim()) {
      try {
        extra = JSON.parse(filterJson);
      } catch (e) {
        found.filter = `Not valid JSON: ${(e as Error).message}`;
      }
    }
    if (rawFilter) {
      filter = extra;
    } else if (!found.filter) {
      if (
        extra !== undefined &&
        (typeof extra !== 'object' || extra === null || Array.isArray(extra))
      ) {
        found.filter =
          'Must be a JSON object, e.g. {"spec.lifecycle": "production"}.';
      } else if (extra && 'kind' in extra) {
        found.filter =
          'Set kinds with the "Entity kinds" field, not in these criteria.';
      } else if (kinds.length > 0) {
        filter = { ...extra, kind: kinds.length === 1 ? kinds[0] : kinds };
      } else if (extra && Object.keys(extra).length > 0) {
        filter = extra;
      }
    }
    const typedLinks = links
      .map(link => ({ title: link.title.trim(), url: link.url.trim() }))
      .filter(link => link.title || link.url);
    const incomplete = typedLinks.some(link => !link.title || !link.url);
    if (forSave && incomplete) {
      found.links = 'Each reference link needs a title and a URL.';
    }
    if (forSave && !rank) found.rank = 'Pick the tier this check belongs to.';
    setErrors(found);
    setErrorsFrom(forSave ? 'save' : 'dryRun');
    if (Object.keys(found).length > 0) return null;
    const enteredLinks = typedLinks.filter(link => link.title && link.url);
    // Keys the form doesn't edit are kept, so a check written through the
    // API doesn't lose them when saved here.
    const {
      category: _category,
      solution: _solution,
      ...otherMetadata
    } = check?.metadata ?? {};
    const metadata: Record<string, unknown> = { ...otherMetadata };
    if (rank) metadata.rank = Number(rank);
    if (category.trim()) metadata.category = category.trim();
    if (solution.trim()) metadata.solution = solution.trim();
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      factIds,
      metadata,
      filter,
      rule,
      links: enteredLinks.length ? enteredLinks : undefined,
      successMetadata: check?.successMetadata,
      failureMetadata: check?.failureMetadata,
    };
  }

  async function persist(input: DynamicCheckInput): Promise<DynamicCheck> {
    if (savedId) {
      return api.updateCheck(savedId, input);
    }
    const created = await api.createCheck(input);
    setSavedId(created.id);
    return created;
  }

  async function handleSave(publish: boolean) {
    setSaveError(null);
    const input = buildInput(true);
    if (!input) return;

    setSaving(true);
    try {
      const saved = await persist(input);
      if (publish) {
        await api.publishCheck(saved.id);
        onPublished();
      } else {
        onSaved(saved);
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDryRun() {
    setDryRunError(null);
    setDryRunResult(null);
    const input = buildInput(false);
    if (!input) return;
    if (!entityRef.trim()) {
      setErrors({
        entityRef: `Pick ${withArticle(
          entityLabel.singular,
        )} to dry-run against.`,
      });
      return;
    }

    setDryRunning(true);
    try {
      const result = await api.dryRun(entityRef.trim(), input);
      setDryRunResult(result);
    } catch (e) {
      setDryRunError((e as Error).message);
    } finally {
      setDryRunning(false);
    }
  }

  const title = check ? `Edit: ${check.name}` : 'New check';

  const coveredKinds = useCoveredKindsText();
  const narrowingKinds = rawFilter ? [] : kinds;
  const covers = (schema: FactSchema) =>
    filterCoversKinds(schema.entityFilter, narrowingKinds);
  const retrieverOptions = factSchemas
    .filter(
      schema =>
        factIds.includes(schema.id) ||
        (scheduledSchemas.includes(schema) && covers(schema)),
    )
    .map(schema => schema.id);
  const uncoveredRetrievers = factIds.filter(id => {
    const schema = factSchemas.find(f => f.id === id);
    return schema && !covers(schema);
  });
  const errorSummary = (from: 'save' | 'dryRun') => {
    const fields = (Object.keys(errors) as Field[]).filter(
      field => field !== 'entityRef',
    );
    return errorsFrom === from && fields.length > 0 ? (
      <Grid item xs={12}>
        <Alert severity="error">
          Fix the highlighted fields first:{' '}
          {fields.map(field => FIELD_LABELS[field]).join(', ')}.
        </Alert>
      </Grid>
    ) : null;
  };

  return (
    <InfoCard title={showTitle ? title : undefined}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <SectionLabel>About</SectionLabel>
        </Grid>
        <Grid item xs={12}>
          <TextField
            id={fieldId('name')}
            label="Name"
            fullWidth
            value={name}
            onChange={e => {
              setName(e.target.value);
              clearError('name');
            }}
            error={!!errors.name}
            helperText={errors.name}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            id={fieldId('description')}
            label="Description"
            fullWidth
            multiline
            minRows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <SectionLabel>Applies to</SectionLabel>
        </Grid>
        {rawFilter ? (
          <Grid item xs={12}>
            <Alert severity="info">
              This check's filter uses a form the kind picker can't show, so it
              is edited as JSON below.
            </Alert>
          </Grid>
        ) : (
          <Grid item xs={12}>
            <Autocomplete
              multiple
              freeSolo
              forcePopupIcon
              openOnFocus
              filterSelectedOptions
              options={sortedKindOptions}
              getOptionLabel={kindLabel}
              value={kinds}
              onChange={(_e, value) =>
                setKinds(Array.from(new Set(value.map(kindOf))))
              }
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={kindLabel(option)}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={params => (
                <TextField
                  {...params}
                  label="Kinds"
                  helperText={`The check runs only against ${entityLabel.plural} of these kinds. Leave empty to run against every ${entityLabel.singular} the chosen facts cover.`}
                />
              )}
            />
          </Grid>
        )}
        <Grid item xs={12}>
          <FilterEditor
            label={
              rawFilter ? 'Filter (JSON)' : 'Additional criteria (optional)'
            }
            kinds={narrowingKinds}
            raw={rawFilter}
            placeholder={`e.g. {"metadata.annotations['openchoreo.io/component-type']": "deployment/service"}`}
            error={!!errors.filter}
            helperText={
              errors.filter ??
              (rawFilter
                ? `Leave empty to apply to all ${entityLabel.plural} the chosen facts support.`
                : `Fields that must also match, keyed by path, e.g. spec.type or metadata.annotations['backstage.io/techdocs-ref']. Matching ignores case; an array value matches any of its entries. ${SUGGEST_SHORTCUT} suggests paths and values.`)
            }
            value={filterJson}
            onChange={next => {
              setFilterJson(next);
              clearError('filter');
            }}
          />
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <SectionLabel>Define the check</SectionLabel>
        </Grid>
        <Grid item xs={12}>
          <Autocomplete
            multiple
            options={retrieverOptions}
            value={factIds}
            onChange={(_e, value) => {
              setFactIds(value);
              clearError('factIds');
            }}
            renderOption={option => {
              const schema = factSchemas.find(f => f.id === option);
              return (
                <div>
                  <Typography variant="body2">{option}</Typography>
                  {schema && (
                    <Typography variant="caption" color="textSecondary">
                      Collects for: {coveredKinds(schema)}
                    </Typography>
                  )}
                </div>
              );
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option} size="small" {...getTagProps({ index })} />
              ))
            }
            renderInput={params => (
              <TextField
                {...params}
                label="Fact retrievers"
                error={!!errors.factIds}
                helperText={
                  errors.factIds ??
                  (narrowingKinds.length > 0
                    ? `Retrievers that collect facts for ${narrowingKinds
                        .map(kindLabel)
                        .join(
                          ', ',
                        )}. Pick these first, since the rule below uses their facts.`
                    : 'Pick these first, since the rule below uses their facts.')
                }
              />
            )}
          />
        </Grid>
        {uncoveredRetrievers.length > 0 && (
          <Grid item xs={12}>
            <Alert severity="warning">
              {uncoveredRetrievers.join(', ')}{' '}
              {uncoveredRetrievers.length === 1 ? "doesn't" : "don't"} collect
              facts for {narrowingKinds.map(kindLabel).join(', ')}, so the check
              has no result on those {entityLabel.plural}.
            </Alert>
          </Grid>
        )}
        <Grid item xs={12}>
          <RuleEditor
            label="Rule (json-rules-engine conditions)"
            value={ruleJson}
            onChange={next => {
              setRuleJson(next);
              clearError('rule');
            }}
            factIds={factIds}
            factSchemas={factSchemas}
            canValidate={canManage}
            error={!!errors.rule}
            helperText={
              errors.rule ??
              `Press ${SUGGEST_SHORTCUT} to suggest facts from the selected retrievers, keys, operators and values, and ${FORMAT_SHORTCUT} to format.`
            }
          />
        </Grid>
        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <SectionLabel>Test it</SectionLabel>
        </Grid>
        <Grid item xs={12}>
          <DryRunEntityField
            kinds={narrowingKinds}
            value={entityRef}
            onChange={next => {
              setEntityRef(next);
              clearError('entityRef');
            }}
            error={errors.entityRef}
            action={
              <Tooltip title={canManage ? '' : NOT_ALLOWED_TOOLTIP}>
                <span>
                  <Button
                    variant="outlined"
                    onClick={handleDryRun}
                    disabled={dryRunning || !canManage}
                  >
                    Dry run
                  </Button>
                </span>
              </Tooltip>
            }
          />
        </Grid>

        {errorSummary('dryRun')}
        {dryRunError && (
          <Grid item xs={12}>
            <Alert severity="error">{dryRunError}</Alert>
          </Grid>
        )}
        {dryRunResult && (
          <Grid item xs={12}>
            <DryRunResultView result={dryRunResult} />
          </Grid>
        )}

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <SectionLabel>Guidance</SectionLabel>
        </Grid>
        <Grid item xs={12}>
          <TextField
            id={fieldId('solution')}
            label="How to pass"
            fullWidth
            multiline
            minRows={2}
            value={solution}
            onChange={e => setSolution(e.target.value)}
            helperText={`Shown with the check on each ${entityLabel.singular}'s scorecard, e.g. the setting to change or the command to run.`}
          />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2" color="textSecondary">
            Reference links
          </Typography>
        </Grid>
        {links.map((link, index) => (
          <Grid item xs={12} key={index}>
            <Box display="flex" alignItems="center" style={{ gap: 8 }}>
              <TextField
                id={fieldId(`link-${index}-title`)}
                label="Title"
                value={link.title}
                onChange={e => {
                  setLinks(
                    links.map((l, i) =>
                      i === index ? { ...l, title: e.target.value } : l,
                    ),
                  );
                  clearError('links');
                }}
                style={{ flex: 1 }}
              />
              <TextField
                id={fieldId(`link-${index}-url`)}
                label="URL"
                value={link.url}
                onChange={e => {
                  setLinks(
                    links.map((l, i) =>
                      i === index ? { ...l, url: e.target.value } : l,
                    ),
                  );
                  clearError('links');
                }}
                style={{ flex: 2 }}
              />
              <IconButton
                aria-label="Remove link"
                onClick={() => setLinks(links.filter((_l, i) => i !== index))}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          </Grid>
        ))}
        <Grid item xs={12}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setLinks([...links, { title: '', url: '' }])}
          >
            Add link
          </Button>
          {errors.links && (
            <Typography variant="body2" color="error">
              {errors.links}
            </Typography>
          )}
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        <Grid item xs={12}>
          <SectionLabel>Classification</SectionLabel>
        </Grid>
        <Grid item xs={6}>
          <Autocomplete
            freeSolo
            forcePopupIcon
            openOnFocus
            options={categoryOptions}
            inputValue={category}
            onInputChange={(_e, value) => setCategory(value)}
            renderInput={params => (
              <TextField
                {...params}
                id={fieldId('category')}
                label="Category"
                fullWidth
                helperText={`Groups checks on ${withArticle(
                  entityLabel.singular,
                )}'s scorecard. Pick one or type a new one.`}
              />
            )}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            select
            required
            id={fieldId('rank')}
            label="Maturity tier"
            fullWidth
            value={rank}
            onChange={e => {
              setRank(e.target.value);
              clearError('rank');
            }}
            error={!!errors.rank}
            helperText={
              errors.rank ??
              `Failing this check keeps ${withArticle(
                entityLabel.singular,
              )} below this tier.`
            }
          >
            {CHECK_TIERS.map(tier => (
              <MenuItem key={tier} value={String(tier)}>
                {tierLabel(tier)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <Box my={1}>
            <Divider />
          </Box>
        </Grid>

        {errorSummary('save')}
        {saveError && (
          <Grid item xs={12}>
            <Alert severity="error">{saveError}</Alert>
          </Grid>
        )}
        <Grid item xs={12}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="flex-end"
            style={{ gap: 8 }}
          >
            <Box flexGrow={1}>
              <Typography variant="body2" color="textSecondary">
                {published
                  ? 'Published: saved changes apply to scores immediately.'
                  : 'Drafts are not evaluated. Publish to include this check in scores.'}
              </Typography>
            </Box>
            {onCancel && (
              <Button onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            )}
            {published ? (
              <Tooltip title={canManage ? '' : NOT_ALLOWED_TOOLTIP}>
                <span>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleSave(false)}
                    disabled={saving || !canManage}
                  >
                    Save changes
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <>
                <Tooltip title={canManage ? '' : NOT_ALLOWED_TOOLTIP}>
                  <span>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => handleSave(false)}
                      disabled={saving || !canManage}
                    >
                      {check ? 'Save draft' : 'Save as draft'}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={canManage ? '' : NOT_ALLOWED_TOOLTIP}>
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => handleSave(true)}
                      disabled={saving || !canManage}
                    >
                      Publish
                    </Button>
                  </span>
                </Tooltip>
              </>
            )}
          </Box>
        </Grid>
      </Grid>
    </InfoCard>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      variant="subtitle2"
      color="textSecondary"
      style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
    >
      {children}
    </Typography>
  );
}
