export type QuotaFixtureTable = "generation_jobs" | "tracks" | "djs";

export interface QuotaFixtureCleanupAdapter {
  deleteRows(
    table: QuotaFixtureTable,
    column: "dj_id" | "id",
    ids: string[],
  ): Promise<unknown | null>;
  deleteAuthUser(userId: string): Promise<unknown | null>;
}

export interface QuotaFixtureIds {
  djIds: string[];
  userIds: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function cleanupError(label: string, cause: unknown): Error {
  return new Error(`${label} failed: ${errorMessage(cause)}`, { cause });
}

export async function cleanupQuotaFixtures(
  adapter: QuotaFixtureCleanupAdapter,
  fixtures: QuotaFixtureIds,
): Promise<Error[]> {
  const failures: Error[] = [];

  if (fixtures.djIds.length > 0) {
    const rowDeletes: {
      table: QuotaFixtureTable;
      column: "dj_id" | "id";
    }[] = [
      { table: "generation_jobs", column: "dj_id" },
      { table: "tracks", column: "dj_id" },
      { table: "djs", column: "id" },
    ];

    for (const { table, column } of rowDeletes) {
      try {
        const error = await adapter.deleteRows(
          table,
          column,
          fixtures.djIds,
        );
        if (error !== null) {
          failures.push(cleanupError(`cleanup ${table} by ${column}`, error));
        }
      } catch (error) {
        failures.push(cleanupError(`cleanup ${table} by ${column}`, error));
      }
    }
  }

  for (const userId of fixtures.userIds) {
    try {
      const error = await adapter.deleteAuthUser(userId);
      if (error !== null) {
        failures.push(cleanupError(`cleanup auth user ${userId}`, error));
      }
    } catch (error) {
      failures.push(cleanupError(`cleanup auth user ${userId}`, error));
    }
  }

  return failures;
}

export function mergeCheckAndCleanupErrors(
  checkFailure: unknown | null,
  cleanupFailures: Error[],
): unknown | null {
  if (cleanupFailures.length === 0) return checkFailure;

  if (checkFailure !== null) {
    return new AggregateError(
      [checkFailure, ...cleanupFailures],
      "quota check failed and fixture cleanup also failed",
      { cause: checkFailure },
    );
  }

  return new AggregateError(
    cleanupFailures,
    "quota fixture cleanup failed",
  );
}

export function formatQuotaCheckFailure(error: unknown): string {
  if (error instanceof AggregateError) {
    return [
      error.message,
      ...error.errors.map(
        (nestedError, index) => `${index + 1}. ${errorMessage(nestedError)}`,
      ),
    ].join("\n");
  }

  return errorMessage(error);
}
