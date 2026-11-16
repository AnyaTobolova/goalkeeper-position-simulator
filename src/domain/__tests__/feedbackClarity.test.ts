import { describe, expect, it } from "vitest";
import { checkAnswer } from "../evaluate";
import { buildFeedback } from "../feedback";
import { fromMeters } from "../geometry";
import { levels } from "../levels";
import { buildPositionZones } from "../positionZones";
import { pitchPresets } from "../presets";

describe("Достоверность подсказок", () => {
  it("не сообщает о сокращённом угле, когда выход оценён как слишком глубокий", () => {
    const level = levels.find((item) => item.id === "two-attackers-center")!;
    const result = checkAnswer(level.initialGoalkeeper, level, pitchPresets["7v7"]);
    const criterion = buildFeedback(result, level).criteria.find((item) => item.key === "controlledExit");
    expect(criterion?.status).not.toBe("good");
    expect(criterion?.text).not.toContain("сокращён");
  });

  it.each(["corner", "cross"] as const)("не выдумывает траекторию и проверку обзора: %s", (category) => {
    const level = levels.find((item) => item.category === category)!;
    const pitch = pitchPresets["7v7"];
    const point = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
    const feedback = buildFeedback(checkAnswer(point, level, pitch), level);
    expect(feedback.visualHints).not.toContain("CROSS_TRAJECTORY");
    expect(feedback.visualHints).not.toContain("BALL_VISIBILITY_LINE");
    expect(feedback.criteria.map((item) => item.key)).not.toContain("trajectory");
    expect(feedback.criteria.map((item) => item.key)).not.toContain("visibility");
    expect(feedback.details?.why).toContain("исход подачи");
  });

  it("объясняет риск выхода, а не только значение цвета на поле", () => {
    const level = levels.find((item) => item.id === "one-v-one-right")!;
    const pitch = pitchPresets["7v7"];
    const point = { x: level.ball.x, y: level.ball.y - 1 };
    const feedback = buildFeedback(checkAnswer(point, level, pitch), level);
    expect(feedback.details?.why).toMatch(/обводки|переброса/);
  });
});
