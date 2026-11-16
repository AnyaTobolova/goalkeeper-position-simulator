import type { CheckResult, Level } from "./types";

// Ошибка выбора на подаче не должна превращать верную позицию ног в неверную.
export function applyExitDecision(result: CheckResult, level: Level, choice: "go" | "stay" | null): CheckResult {
  if (!level.exitDecision || !choice || choice === level.exitDecision) return result;

  const decisionError = result.result === "correct" ? "WRONG_EXIT_DECISION" : result.errorType;
  const decisionText = level.exitDecision === "go"
    ? "По условию мяч доступен и путь свободен: в этом упражнении выбираем выход."
    : "По условию путь к мячу перекрыт игроками: сохрани позицию у ворот.";
  return {
    ...result,
    result: result.result === "dangerous" ? "dangerous" : "wrong",
    score: Math.min(result.score, 55),
    text: decisionText,
    repeat: true,
    errorType: decisionError,
    evaluation: {
      ...result.evaluation,
      mainErrorType: decisionError ?? result.evaluation.mainErrorType,
      notes: [...result.evaluation.notes, "Решение на подаче выбрано неверно."]
    }
  };
}
