const LOGIN_PERMIT_TTL_MS = 5_000;

let loginPermitIssuedAt: number | null = null;

export function grantIntroLoginPermit(nowMs = Date.now()): void {
  loginPermitIssuedAt = nowMs;
}

export function consumeIntroLoginPermit(nowMs = Date.now()): boolean {
  const issuedAt = loginPermitIssuedAt;
  loginPermitIssuedAt = null;
  return issuedAt !== null && nowMs >= issuedAt && nowMs - issuedAt <= LOGIN_PERMIT_TTL_MS;
}
