import { privateMediaReference } from "./media-reference.ts";

export type R2Access = "public" | "private";
export type R2Environment = {
  accountId: string;
  publicBucket: string;
  privateBucket: string;
  publicBase: string;
};

const GENERATED_OBJECT_KEY =
  /^(?:tracks|captions|covers|avatars)\/generated\/[A-Za-z0-9._%:/-]+$/;

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`R2 ${label} is required`);
  return normalized;
}

export function storageTarget(
  access: R2Access,
  key: string,
  environment: R2Environment,
): { bucket: string; objectUrl: string; reference: string } {
  const accountId = required(environment.accountId, "account ID");
  if (
    !GENERATED_OBJECT_KEY.test(key) || key.includes("..") ||
    key.includes("\\") || key.includes("?") || key.includes("#") ||
    /[\u0000-\u001f\u007f]/.test(key)
  ) {
    throw new Error("invalid generated object key");
  }

  if (access === "private") {
    const bucket = required(environment.privateBucket, "private bucket");
    let reference: string;
    try {
      reference = privateMediaReference(key);
    } catch {
      throw new Error("invalid private media key");
    }
    return {
      bucket,
      objectUrl: `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`,
      reference,
    };
  }

  if (access !== "public") throw new Error("invalid R2 access mode");
  const bucket = required(environment.publicBucket, "public bucket");
  const publicBase = required(environment.publicBase, "public base").replace(/\/+$/, "");
  return {
    bucket,
    objectUrl: `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`,
    reference: `${publicBase}/${key}`,
  };
}
