/** Hints persist with the deal and cannot be refunded by Undo or reload. */
export const HINT_LIMIT = 3;
export function hintsRemaining(data: Record<string, unknown>): number {
  return Math.max(0, HINT_LIMIT - Math.max(0, Number(data.hints) || 0));
}
export function useHint(data: Record<string, unknown>): boolean {
  if (!hintsRemaining(data)) return false;
  data.hints = Math.max(0, Number(data.hints) || 0) + 1;
  return true;
}
