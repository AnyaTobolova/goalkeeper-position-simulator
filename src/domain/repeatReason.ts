import type { LevelProgress } from "./types";

// Последний ответ определяет цель повтора; прежние ошибки остаются в истории.
export function repeatReason(progress?: LevelProgress): "fix" | "reinforce" | null {
  if (!progress?.needsRepeat) return null;
  return progress.lastResult === "correct" && progress.correctStreak >= 1 ? "reinforce" : "fix";
}
