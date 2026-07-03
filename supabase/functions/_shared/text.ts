// Strip control chars, collapse whitespace, trim, cap length.
export function sanitize(text: string, max: number): string {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
