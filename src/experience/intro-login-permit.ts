let loginPermitted = false;

export function grantIntroLoginPermit(): void {
  loginPermitted = true;
}

export function consumeIntroLoginPermit(): boolean {
  if (!loginPermitted) return false;
  loginPermitted = false;
  return true;
}
