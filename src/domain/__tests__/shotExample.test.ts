import { describe, expect, it } from "vitest";
import { checkAnswer, freeKickWallZone } from "../evaluate";
import { fromMeters, toMeters } from "../geometry";
import { levels } from "../levels";
import { openGoalSegments, openGoalSegmentsWithWall } from "../openGoalSegments";
import { buildPositionZones } from "../positionZones";
import { pitchPresets } from "../presets";
import { shotExample } from "../shotExample";
import { applyLevelVariation } from "../variation";

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

  it("не показывает гол при «Почти» во всех сценариях, форматах и вариантах", () => {
    for (const pitch of Object.values(pitchPresets)) {
      for (const baseLevel of levels) {
        for (let attempt = 0; attempt <= 20; attempt++) {
          const level = applyLevelVariation(baseLevel, attempt);
          const point = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
          const checked = checkAnswer(point, level, pitch);
          const result = { ...checked, result: "almost" as const };
          expect(shotExample(result, level, point, pitch)?.isGoal).toBe(false);
        }
      }
    }
  });

  it("показывает гол при ошибке только в открытый по схеме участок", () => {
    const pitch = pitchPresets["7v7"];
    const level = levels.find((item) => item.id === "angle-right-half")!;
    const point = { x: 40, y: 2 };
    const result = checkAnswer(point, level, pitch);
    expect(["wrong", "dangerous"]).toContain(result.result);
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
    expect(["wrong", "dangerous"]).toContain(result.result);
    expect(shotExample(result, level, point, pitch)).toBeNull();
  });

  it("для штрафного показывает сейв при хорошем ответе и гол только в участок, открытый с учётом стенки", () => {
    const pitch = pitchPresets["7v7"];
    const level = levels.find((item) => item.id === "free-kick-close-center")!;
    const zone = freeKickWallZone(toMeters(level.ball, pitch), pitch, level.goalTarget?.side);
    const wall = { count: level.freeKick!.recommendedWallCount, x: (zone.xMin + zone.xMax) / 2, y: (zone.yMin + zone.yMax) / 2 };
    const ideal = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
    const good = checkAnswer(ideal, level, pitch, undefined, wall);
    expect(good.result).toBe("correct");
    expect(good.evaluation.openShotTarget).toBeDefined();
    expect(shotExample(good, level, ideal, pitch, wall)?.isGoal).toBe(false);
    const badPoint = { x: 35, y: 1 };
    const bad = checkAnswer(badPoint, level, pitch, undefined, wall);
    expect(["wrong", "dangerous"]).toContain(bad.result);
    const example = shotExample(bad, level, badPoint, pitch, wall)!;
    expect(example.isGoal).toBe(true);
    const target = toMeters(example.target, pitch);
    expect(openGoalSegmentsWithWall(toMeters(level.ball, pitch), toMeters(badPoint, pitch), pitch, { ...toMeters(wall, pitch), count: wall.count })
      .some(([left, right]) => target.x > left && target.x < right)).toBe(true);
  });

  it("не задаёт пример прямого удара для углового и навеса", () => {
    for (const id of ["high-cross-crowd", "corner-right-open-far-post"]) {
      const level = levels.find((item) => item.id === id)!;
      const pitch = pitchPresets["7v7"];
      const point = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
      expect(checkAnswer(point, level, pitch).evaluation.openShotTarget).toBeUndefined();
    }
  });
});
