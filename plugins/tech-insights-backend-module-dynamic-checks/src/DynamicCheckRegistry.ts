import { ConflictError, NotFoundError } from '@backstage/errors';
import type { DatabaseService } from '@backstage/backend-plugin-api';
import type { TechInsightJsonRuleCheck } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';

// Sourced from DatabaseService's own return type rather than importing the
// `knex` package directly — this package's own resolution of `knex` can end
// up as a structurally-identical but nominally distinct type from the one
// bundled with @backstage/backend-plugin-api, which TypeScript then treats
// as incompatible. Deriving the type this way guarantees a single source.
type Knex = Awaited<ReturnType<DatabaseService['getClient']>>;

const TABLE = 'dynamic_checks';

export type CheckStatus = 'draft' | 'published';

interface Row {
  id: string;
  type: string;
  name: string;
  description: string | null;
  fact_ids: string;
  metadata: string | null;
  filter: string | null;
  rule: string;
  status: CheckStatus;
  links: string | null;
  success_metadata: string | null;
  failure_metadata: string | null;
}

function parseOptional<T>(value: string | null): T | undefined {
  return value ? (JSON.parse(value) as T) : undefined;
}

function rowToCheck(row: Row): TechInsightJsonRuleCheck {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description ?? '',
    factIds: JSON.parse(row.fact_ids),
    // Never undefined: @backstage-community/plugin-tech-insights-maturity's
    // ScoringDataFormatter reads check.metadata.rank/.category with no
    // null-guard — a check with neither set would otherwise crash the
    // maturity computation for every entity it runs against.
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    filter: row.filter ? JSON.parse(row.filter) : undefined,
    rule: JSON.parse(row.rule),
    links: parseOptional(row.links),
    successMetadata: parseOptional(row.success_metadata),
    failureMetadata: parseOptional(row.failure_metadata),
  };
}

function checkToRow(check: TechInsightJsonRuleCheck, status: CheckStatus) {
  return {
    id: check.id,
    type: check.type,
    name: check.name,
    description: check.description ?? null,
    fact_ids: JSON.stringify(check.factIds),
    metadata: check.metadata ? JSON.stringify(check.metadata) : null,
    filter: check.filter ? JSON.stringify(check.filter) : null,
    rule: JSON.stringify(check.rule),
    links: check.links?.length ? JSON.stringify(check.links) : null,
    success_metadata: check.successMetadata
      ? JSON.stringify(check.successMetadata)
      : null,
    failure_metadata: check.failureMetadata
      ? JSON.stringify(check.failureMetadata)
      : null,
    status,
  };
}

/**
 * DB-backed store of checks and their draft or published status. jsonfc
 * reads it through `EvaluableCheckRegistry`, which hands it only the
 * published checks that can be evaluated.
 */
export class DynamicCheckRegistry {
  constructor(private readonly db: Knex) {}

  async register(
    check: TechInsightJsonRuleCheck,
  ): Promise<TechInsightJsonRuleCheck> {
    const existing = await this.db(TABLE).where({ id: check.id }).first();
    if (existing) {
      throw new ConflictError(`Check '${check.id}' is already registered.`);
    }
    await this.db(TABLE).insert(checkToRow(check, 'draft'));
    return check;
  }

  async update(
    checkId: string,
    check: TechInsightJsonRuleCheck,
  ): Promise<TechInsightJsonRuleCheck> {
    const existing = await this.db(TABLE).where({ id: checkId }).first();
    if (!existing) {
      throw new NotFoundError(`Check '${checkId}' is not registered.`);
    }
    await this.db(TABLE)
      .where({ id: checkId })
      .update({
        ...checkToRow(check, existing.status),
        updated_at: this.db.fn.now(),
      });
    return check;
  }

  async publish(checkId: string): Promise<void> {
    const count = await this.db(TABLE)
      .where({ id: checkId })
      .update({ status: 'published', updated_at: this.db.fn.now() });
    if (!count) {
      throw new NotFoundError(`Check '${checkId}' is not registered.`);
    }
  }

  /** Reverts a published check to draft — removes it from `list()`, so it
   * stops being evaluated for every entity until published again. */
  async unpublish(checkId: string): Promise<void> {
    const count = await this.db(TABLE)
      .where({ id: checkId })
      .update({ status: 'draft', updated_at: this.db.fn.now() });
    if (!count) {
      throw new NotFoundError(`Check '${checkId}' is not registered.`);
    }
  }

  async delete(checkId: string): Promise<void> {
    await this.db(TABLE).where({ id: checkId }).delete();
  }

  async get(checkId: string): Promise<TechInsightJsonRuleCheck> {
    const row = await this.db(TABLE).where({ id: checkId }).first();
    if (!row) {
      throw new NotFoundError(`Check '${checkId}' is not registered.`);
    }
    return rowToCheck(row);
  }

  async getStatus(checkId: string): Promise<CheckStatus> {
    const row = await this.db(TABLE).where({ id: checkId }).first('status');
    if (!row) {
      throw new NotFoundError(`Check '${checkId}' is not registered.`);
    }
    return row.status;
  }

  /** Published checks with these ids; drafts are never evaluated. */
  async getAllPublished(checks: string[]): Promise<TechInsightJsonRuleCheck[]> {
    const rows = await this.db(TABLE)
      .whereIn('id', checks)
      .where({ status: 'published' });
    return rows.map(rowToCheck);
  }

  /** Published checks only, the ones live evaluation sees. */
  async list(): Promise<TechInsightJsonRuleCheck[]> {
    const rows = await this.db(TABLE).where({ status: 'published' });
    return rows.map(rowToCheck);
  }

  /** Draft + published — for the check-editor UI's list view. */
  async listAll(): Promise<
    Array<TechInsightJsonRuleCheck & { status: CheckStatus }>
  > {
    const rows: Row[] = await this.db(TABLE).select();
    return rows.map(row => ({ ...rowToCheck(row), status: row.status }));
  }
}
