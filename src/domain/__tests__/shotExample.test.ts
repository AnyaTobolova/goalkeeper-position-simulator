import { describe, expect, it } from "vitest";
import { levels } from "../levels";
import { pitchPresets } from "../presets";
import { shotExample } from "../shotExample";
import { openGoalSegments } from "../openGoalSegments";
import { toMeters } from "../geometry";

describe("Пример удара", () => {
  it("гол направлен в открытый участок плоской схемы, а не зависит от оценки", () => {
    const pitch = pitchPresets["7v7"];
    const keeper = { x: 50, y: 3 };
    const tested = levels.filter((level) => !level.freeKick).map((level) => ({ level, example: shotExample(level, keeper, pitch) }));
    const goals = tested.filter(({ example }) => example.isGoal);
    expect(goals.length).toBeGreaterThan(0);
    expect(tested.some(({ example }) => !example.isGoal)).toBe(true);
    for (const { level, example } of goals) {
      const target = toMeters(example.target, pitch);
      const segments = openGoalSegments(toMeters(level.ball, pitch), toMeters(keeper, pitch), pitch);
      expect(segments.some(([left, right]) => target.x > left && target.x < right)).toBe(true);
    }
  });

  it("когда вся линия закрыта, показывает сейв", () => {
    const pitch = pitchPresets["7v7"];
    const level = levels.find((item) => item.id === "angle-right-half")!;
    const example = shotExample(level, { x: level.ball.x, y: level.ball.y - 1 }, pitch);
    expect(example.isGoal).toBe(false);
  });
});
