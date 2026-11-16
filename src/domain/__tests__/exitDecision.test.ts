import { describe, expect, it } from "vitest";
import { applyExitDecision } from "../exitDecision";
import { buildFeedback } from "../feedback";
import { checkAnswer } from "../evaluate";
import { levels } from "../levels";
import { pitchPresets } from "../presets";
import { buildPositionZones } from "../positionZones";
import { fromMeters } from "../geometry";

describe("Решение на подаче", () => {
  it("разбирает неверный выбор без выдуманной ошибки ног и стрелки перемещения", () => {
    const level = levels.find((item) => item.id === "high-cross-clean-right")!;
    const pitch = pitchPresets["7v7"];
    const ideal = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
    const original = checkAnswer(ideal, level, pitch);
    expect(original.result).toBe("correct");
    const result = applyExitDecision(original, level, "stay");
    const feedback = buildFeedback(result, level);
    expect(result.result).toBe("wrong");
    expect(result.errorType).toBe("WRONG_EXIT_DECISION");
    expect(feedback.summary).toContain("Позиция ног подходит");
    expect(feedback.mainAdvice).toContain("Выйду на мяч");
    expect(feedback.details?.why).toContain("предполагается");
    expect(feedback.details?.why).toContain("не моделируются");
    expect(feedback.criteria.find((item) => item.key === "depth")?.status).toBe("good");
    expect(feedback.visualHints).not.toContain("MOVE_ARROW");
    expect(feedback.visualHints).not.toContain("TOO_DEEP_ZONE");
    expect(applyExitDecision(original, level, "go")).toBe(original);
  });

  it("объясняет решение в толпе через условие, а не прогноз ловли", () => {
    const level = levels.find((item) => item.id === "high-cross-crowd")!;
    const pitch = pitchPresets["7v7"];
    const ideal = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
    const result = applyExitDecision(checkAnswer(ideal, level, pitch), level, "go");
    const feedback = buildFeedback(result, level);
    expect(feedback.details?.why).toContain("предполагается");
    expect(feedback.mainAdvice).toContain("Останусь в воротах");
  });
});
