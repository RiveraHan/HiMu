import {
  parseGeneratedPublicKey,
  privateMediaReference,
  type PrivateMediaKind,
} from "../../supabase/functions/_shared/media-reference";

export type PrivateMediaRow = {
  kind: PrivateMediaKind;
  id: string;
  audioRef: string | null;
};

export type ObjectMetadata = {
  contentLength?: number;
  etag?: string;
};

export type PrivateMediaMigrationDependencies = {
  copyToPrivate: (key: string) => Promise<ObjectMetadata>;
  verifyPrivate: (key: string) => Promise<ObjectMetadata>;
  updateReference: (
    row: PrivateMediaRow,
    reference: string,
  ) => Promise<boolean>;
  deletePublic: (key: string) => Promise<void>;
};

export type PrivateMediaMigrationResult = {
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  remaining: number;
};

function normalizedEtag(value: string | undefined): string | undefined {
  return value?.replace(/^"|"$/g, "");
}

function metadataMatches(
  copied: ObjectMetadata,
  verified: ObjectMetadata,
): boolean {
  if (
    copied.contentLength !== undefined &&
    verified.contentLength !== undefined &&
    copied.contentLength !== verified.contentLength
  ) {
    return false;
  }

  const copiedEtag = normalizedEtag(copied.etag);
  const verifiedEtag = normalizedEtag(verified.etag);
  return copiedEtag === undefined || verifiedEtag === undefined ||
    copiedEtag === verifiedEtag;
}

/**
 * Moves legacy generated audio out of the public bucket without creating a
 * broken-reference window. The public source is deleted only after the copy is
 * verified and the database reference is changed conditionally.
 */
export async function migratePrivateMediaRows(
  rows: PrivateMediaRow[],
  dependencies: PrivateMediaMigrationDependencies,
  options: { publicBase: string; dryRun?: boolean },
): Promise<PrivateMediaMigrationResult> {
  const result: PrivateMediaMigrationResult = {
    scanned: rows.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
    remaining: 0,
  };

  for (const row of rows) {
    const parsed = parseGeneratedPublicKey(row.audioRef, options.publicBase);
    if (!parsed || parsed.kind !== row.kind) {
      result.skipped += 1;
      continue;
    }

    if (options.dryRun) {
      result.remaining += 1;
      continue;
    }

    try {
      const copied = await dependencies.copyToPrivate(parsed.key);
      const verified = await dependencies.verifyPrivate(parsed.key);
      if (!metadataMatches(copied, verified)) {
        throw new Error("private object verification failed");
      }

      const updated = await dependencies.updateReference(
        row,
        privateMediaReference(parsed.key),
      );
      if (!updated) {
        throw new Error("database reference changed concurrently");
      }

      await dependencies.deletePublic(parsed.key);
      result.migrated += 1;
    } catch {
      result.failed += 1;
      result.remaining += 1;
    }
  }

  return result;
}
