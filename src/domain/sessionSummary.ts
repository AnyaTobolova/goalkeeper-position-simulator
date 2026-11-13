import type { ErrorType, ResultKind } from "./types";

export type SessionAttempt = { levelId: string; result: ResultKind; score: number; errorType?: ErrorType };

// В зачёт марафона идёт первая попытка каждой ситуации; повторы остаются в статистике.
export function firstAttempts(attempts: SessionAttempt[]): SessionAttempt[] {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    if (seen.has(attempt.levelId)) return false;
    seen.add(attempt.levelId);
    return true;
  });
}

export function marathonPoints(attempts: SessionAttempt[]): number {
  return firstAttempts(attempts).reduce((sum, attempt) => sum + attempt.score, 0);
}
