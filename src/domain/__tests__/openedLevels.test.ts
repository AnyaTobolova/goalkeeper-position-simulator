import { describe, expect, it } from "vitest";
import { openedLevels } from "../openedLevels";
import { levels } from "../levels";
import type { LevelProgress } from "../types";

const attempt: LevelProgress = { attempts: 1, bestScore: 100, lastResult: "correct", needsRepeat: true, correctStreak: 1, wrongAttempts: 0, almostAttempts: 0, errorCounts: {} };

describe("доступные ситуации", () => {
  it("открывает первые задания обоих блоков и не открывает остальные без прохождения", () => {
    const result = openedLevels(levels, {}, { base_position: 0, reaction_to_ball_owner: 0 });
    expect(result.map((level) => level.id)).toEqual([levels[0].id, levels.find((level) => level.stage === "reaction_to_ball_owner")!.id]);
  });

  it("сохраняет доступ к достигнутым и сыгранным в других режимах ситуациям", () => {
    const later = levels.find((level) => level.id === "free-kick-close-center")!;
    const result = openedLevels(levels, { [later.id]: attempt }, { base_position: 2, reaction_to_ball_owner: 0 });
    expect(result).toContain(later);
    expect(result).toContain(levels[2]);
    expect(result).not.toContain(levels[3]);
  });
});
