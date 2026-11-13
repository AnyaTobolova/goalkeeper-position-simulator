import { describe, expect, it } from "vitest";
import { checkAnswer } from "../evaluate";
import { fromMeters, toMeters } from "../geometry";
import { levels } from "../levels";
import { openGoalSegments } from "../openGoalSegments";
import { buildPositionZones } from "../positionZones";
import { pitchPresets } from "../presets";
import { shotExample } from "../shotExample";

describe("Пример удара в разборе", () => {
  it("показывает сейв при отличной позиции для всех сценариев и форматов", () => {
    for (const pitch of Object.values(pitchPresets)) {
      for (const level of levels.filter((item) => !item.freeKick)) {
        const point = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
        const result = checkAnswer(point, level, pitch);
        if (result.result === "correct") expect(shotExample(result, level, point, pitch)?.isGoal).toBe(false);
      }
    }
  });

  it("показывает гол при ошибке только в открытый по схеме участок", () => {
    const pitch = pitchPresets["7v7"];
    const level = levels.find((item) => item.id === "angle-right-half")!;
    const point = { x: 40, y: 2 };
    const result = checkAnswer(point, level, pitch);
    expect(result.result).not.toBe("correct");
    const example = shotExample(result, level, point, pitch)!;
    expect(example.isGoal).toBe(true);
    const target = toMeters(example.target, pitch);
    expect(openGoalSegments(toMeters(level.ball, pitch), toMeters(point, pitch), pitch)
      .some(([left, right]) => target.x > left && target.x < right)).toBe(true);
  });

  it("не рисует гол сквозь полностью закрытую линию", () => {
    const pitch = pitchPresets["7v7"];
    const level = levels.find((item) => item.id === "angle-right-half")!;
    const point = { x: level.ball.x, y: level.ball.y - 1 };
    const result = checkAnswer(point, level, pitch);
    expect(result.result).not.toBe("correct");
    expect(shotExample(result, level, point, pitch)).toBeNull();
  });
});
