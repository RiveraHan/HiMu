import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import {
  migratePrivateMediaRows,
  type ObjectMetadata,
  type PrivateMediaRow,
} from "./private-media";
import { withTransientRetry } from "./retry";

type Options = {
  dryRun: boolean;
  batchSize: number;
  cursor?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOptions(args: string[]): Options {
  const options: Options = { dryRun: false, batchSize: 100 };
  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--batch-size=")) {
      const value = Number(arg.slice("--batch-size=".length));
      if (!Number.isInteger(value) || value < 1 || value > 500) {
        throw new Error("--batch-size must be an integer from 1 to 500");
      }
      options.batchSize = value;
      continue;
    }
    if (arg.startsWith("--cursor=")) {
      const value = arg.slice("--cursor=".length);
      if (!UUID.test(value)) throw new Error("--cursor must be a UUID");
      options.cursor = value;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function encodedKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function metadata(response: Response): ObjectMetadata {
  const rawLength = response.headers.get("content-length");
  const contentLength = rawLength === null ? undefined : Number(rawLength);
  return {
    contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
    etag: response.headers.get("etag") ?? undefined,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const publicBucket = required("R2_BUCKET");
  const privateBucket = required("R2_PRIVATE_BUCKET");
  const publicBase = required("R2_PUBLIC_BASE").replace(/\/+$/, "");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  if (privateBucket === publicBucket) {
    throw new Error("R2_PRIVATE_BUCKET must be different from R2_BUCKET");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const publicEndpoint = `https://${accountId}.r2.cloudflarestorage.com/${publicBucket}`;
  const privateEndpoint = `https://${accountId}.r2.cloudflarestorage.com/${privateBucket}`;

  async function listRows(cursor: string | undefined): Promise<PrivateMediaRow[]> {
    const prefix = `${publicBase}/`;
    let trackQuery = supabase
      .from("tracks")
      .select("id,audio_url")
      .eq("is_public", false)
      .like("audio_url", `${prefix}tracks/generated/%`)
      .order("id", { ascending: true })
      .limit(options.batchSize);
    let captionQuery = supabase
      .from("generation_jobs")
      .select("id,caption_audio_url")
      .eq("is_public", false)
      .like("caption_audio_url", `${prefix}captions/generated/%`)
      .order("id", { ascending: true })
      .limit(options.batchSize);
    if (cursor) {
      trackQuery = trackQuery.gt("id", cursor);
      captionQuery = captionQuery.gt("id", cursor);
    }

    const [tracks, captions] = await Promise.all([trackQuery, captionQuery]);
    if (tracks.error) throw tracks.error;
    if (captions.error) throw captions.error;
    return [
      ...(tracks.data ?? []).map((item) => ({
        kind: "track" as const,
        id: item.id,
        audioRef: item.audio_url,
      })),
      ...(captions.data ?? []).map((item) => ({
        kind: "caption" as const,
        id: item.id,
        audioRef: item.caption_audio_url,
      })),
    ].sort((a, b) => a.id.localeCompare(b.id)).slice(0, options.batchSize);
  }

  async function head(endpoint: string, key: string): Promise<Response> {
    const response = await withTransientRetry(() =>
      r2.fetch(`${endpoint}/${encodedKey(key)}`, { method: "HEAD" })
    );
    if (!response.ok) throw new Error(`R2 HEAD failed (${response.status})`);
    return response;
  }

  const totals = { scanned: 0, migrated: 0, skipped: 0, failed: 0, remaining: 0 };
  let cursor = options.cursor;
  while (true) {
    const rows = await listRows(cursor);
    if (rows.length === 0) break;

    const result = await migratePrivateMediaRows(rows, {
      copyToPrivate: async (key) => {
        const source = await head(publicEndpoint, key);
        const headers: Record<string, string> = {
          "x-amz-copy-source": `/${encodeURIComponent(publicBucket)}/${encodedKey(key)}`,
          "x-amz-metadata-directive": "REPLACE",
          "Cache-Control": "private, no-store",
        };
        const contentType = source.headers.get("content-type");
        if (contentType) headers["Content-Type"] = contentType;
        const copied = await withTransientRetry(() =>
          r2.fetch(`${privateEndpoint}/${encodedKey(key)}`, {
            method: "PUT",
            headers,
          })
        );
        if (!copied.ok) throw new Error(`R2 copy failed (${copied.status})`);
        return metadata(source);
      },
      verifyPrivate: async (key) => metadata(await head(privateEndpoint, key)),
      updateReference: async (row, reference) => {
        const table = row.kind === "track" ? "tracks" : "generation_jobs";
        const column = row.kind === "track" ? "audio_url" : "caption_audio_url";
        const { data, error } = await supabase
          .from(table)
          .update({ [column]: reference })
          .eq("id", row.id)
          .eq("is_public", false)
          .eq(column, row.audioRef)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return data?.id === row.id;
      },
      deletePublic: async (key) => {
        const response = await withTransientRetry(() =>
          r2.fetch(`${publicEndpoint}/${encodedKey(key)}`, { method: "DELETE" })
        );
        if (!response.ok && response.status !== 404) {
          throw new Error(`R2 DELETE failed (${response.status})`);
        }
      },
      onError: (row, error) => {
        console.error(JSON.stringify({
          kind: row.kind,
          id: row.id,
          error: error instanceof Error ? error.message : "unknown migration error",
        }));
      },
    }, { publicBase, dryRun: options.dryRun });

    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] += result[key];
    }
    cursor = rows.at(-1)?.id;
    if (result.failed > 0) {
      console.log(JSON.stringify({ mode: options.dryRun ? "dry-run" : "live", ...totals, cursor }));
      throw new Error("migration stopped after a failed row; rerun without a cursor after correcting it");
    }
  }

  console.log(JSON.stringify({
    mode: options.dryRun ? "dry-run" : "live",
    ...totals,
    cursor: cursor ?? null,
  }));
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "private media migration failed");
    process.exitCode = 1;
  });
}
