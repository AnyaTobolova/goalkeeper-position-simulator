import { describe, expect, it } from "vitest";
import { computeBadges, isScenarioMastered, keeperRank } from "../badges";
import { levels } from "../levels";
import { summarizeSkills } from "../skillSummary";
import type { LevelProgress, Progress } from "../types";

const record = (attempts: number, wrongAttempts: number, correctStreak: number): LevelProgress => ({
  attempts, wrongAttempts, correctStreak, almostAttempts: 0, bestScore: 100,
  lastResult: correctStreak ? "correct" : "wrong", needsRepeat: correctStreak < 2, errorCounts: {}
});

describe("Поддерживающая статистика", () => {
  it("считает ситуацию закреплённой и для бейджа только после двух последних успехов", () => {
    const angle = levels.filter((level) => level.category === "shot_angle").slice(0, 4);
    const progress: Progress = Object.fromEntries(angle.map((level) => [level.id, record(1, 0, 1)]));
    expect(isScenarioMastered(progress[angle[0].id])).toBe(false);
    expect(computeBadges(progress, levels, null).find((badge) => badge.id === "near-post")?.earned).toBe(false);
    for (const level of angle) progress[level.id] = record(2, 0, 2);
    expect(computeBadges(progress, levels, null).find((badge) => badge.id === "near-post")?.earned).toBe(true);
    expect(keeperRank(angle.filter((level) => isScenarioMastered(progress[level.id])).length)).toBe("Новичок");
    progress[angle[0].id] = record(3, 1, 0);
    expect(computeBadges(progress, levels, null).find((badge) => badge.id === "near-post")?.earned).toBe(false);
  });

  it("не делает вывод по одной ситуации и старым неполным данным", () => {
    const angle = levels.filter((level) => level.category === "shot_angle").slice(0, 2);
    expect(summarizeSkills(angle, { [angle[0].id]: record(10, 0, 2) }).strong).toHaveLength(0);
    const incomplete = { ...record(1, 0, 1), wrongAttempts: undefined } as unknown as LevelProgress;
    expect(summarizeSkills(angle, { [angle[0].id]: record(2, 0, 2), [angle[1].id]: incomplete }).strong).toHaveLength(0);
  });

  it("показывает попытки пенальти, не делая вывод по единственной ситуации", () => {
    const penalty = levels.find((level) => level.category === "penalty")!;
    const summary = summarizeSkills([penalty], { [penalty.id]: record(4, 0, 4) });
    expect(summary.penaltyAttempts).toBe(4);
    expect(summary.strong).toHaveLength(0);
    expect(summary.practice).toHaveLength(0);
  });

  it("различает сильные темы и темы для тренировки по накопленным попыткам", () => {
    const angle = levels.filter((level) => level.category === "shot_angle").slice(0, 2);
    const depth = levels.filter((level) => level.category === "depth").slice(0, 2);
    const progress: Progress = {
      [angle[0].id]: record(2, 0, 2), [angle[1].id]: record(2, 0, 2),
      [depth[0].id]: record(2, 2, 0), [depth[1].id]: record(2, 1, 1)
    };
    const summary = summarizeSkills([...angle, ...depth], progress);
    expect(summary.strong.map((item) => item.category)).toEqual(["shot_angle"]);
    expect(summary.practice.map((item) => item.category)).toEqual(["depth"]);
  });
});
