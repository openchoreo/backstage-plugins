import { NotAllowedError, NotFoundError } from '@backstage/errors';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type { TechInsightCheckRegistry } from '@backstage-community/plugin-tech-insights-node';
import type { TechInsightJsonRuleCheck } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import type { DynamicCheckRegistry } from './DynamicCheckRegistry';
import type { CheckValidator } from './validation';

/**
 * The checks jsonfc evaluates: published ones that can be evaluated against
 * the current fact schemas. A published check whose retriever or facts have
 * since gone away is left out, with a warning, rather than failing the
 * evaluation of every other check on the same entity.
 */
export class EvaluableCheckRegistry
  implements TechInsightCheckRegistry<TechInsightJsonRuleCheck>
{
  private readonly reported = new Set<string>();

  constructor(
    private readonly registry: DynamicCheckRegistry,
    private readonly validator: CheckValidator,
    private readonly logger: LoggerService,
  ) {}

  async register(): Promise<TechInsightJsonRuleCheck> {
    throw new NotAllowedError(
      'Checks are created through the dynamic-checks API.',
    );
  }

  async get(checkId: string): Promise<TechInsightJsonRuleCheck> {
    const [check] = await this.getAll([checkId]);
    if (!check) {
      throw new NotFoundError(
        `No published check '${checkId}' that can be evaluated.`,
      );
    }
    return check;
  }

  async getAll(checks: string[]): Promise<TechInsightJsonRuleCheck[]> {
    return this.evaluable(await this.registry.getAllPublished(checks));
  }

  async list(): Promise<TechInsightJsonRuleCheck[]> {
    return this.evaluable(await this.registry.list());
  }

  private async evaluable(
    checks: TechInsightJsonRuleCheck[],
  ): Promise<TechInsightJsonRuleCheck[]> {
    const problemsOfEach = await this.validator.problemsOfEach(checks);
    return checks
      .map((check, index) => ({ check, problems: problemsOfEach[index] }))
      .filter(({ check, problems }) => {
        if (problems.length === 0) return true;
        const summary = problems.map(p => p.message).join(' ');
        const key = `${check.id}:${summary}`;
        if (!this.reported.has(key)) {
          this.reported.add(key);
          this.logger.warn(
            `Not evaluating published check '${check.name}' (${check.id}): ${summary}`,
          );
        }
        return false;
      })
      .map(({ check }) => check);
  }
}

/**
 * A fixed set of checks, for evaluating a draft without storing it. jsonfc
 * builds its own in-memory registry when given `checks`, but then validates
 * each one in its constructor without awaiting the result.
 */
export class StaticCheckRegistry
  implements TechInsightCheckRegistry<TechInsightJsonRuleCheck>
{
  constructor(private readonly checks: TechInsightJsonRuleCheck[]) {}

  async register(): Promise<TechInsightJsonRuleCheck> {
    throw new NotAllowedError('This registry holds a fixed set of checks.');
  }

  async get(checkId: string): Promise<TechInsightJsonRuleCheck> {
    const check = this.checks.find(c => c.id === checkId);
    if (!check) throw new NotFoundError(`No check '${checkId}'.`);
    return check;
  }

  async getAll(checks: string[]): Promise<TechInsightJsonRuleCheck[]> {
    return this.checks.filter(c => checks.includes(c.id));
  }

  async list(): Promise<TechInsightJsonRuleCheck[]> {
    return this.checks;
  }
}
