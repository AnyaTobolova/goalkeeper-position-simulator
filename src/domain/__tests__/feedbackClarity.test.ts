import { describe, expect, it } from "vitest";
import { checkAnswer } from "../evaluate";
import { buildFeedback } from "../feedback";
import { fromMeters } from "../geometry";
import { levels } from "../levels";
import { buildPositionZones } from "../positionZones";
import { pitchPresets } from "../presets";

describe("Достоверность подсказок", () => {
  it.each(["corner", "cross"] as const)("не выдумывает траекторию и проверку обзора: %s", (category) => {
    const level = levels.find((item) => item.category === category)!;
    const pitch = pitchPresets["7v7"];
    const point = fromMeters(buildPositionZones(level, pitch).ideal, pitch);
    const feedback = buildFeedback(checkAnswer(point, level, pitch), level);
    expect(feedback.visualHints).not.toContain("CROSS_TRAJECTORY");
    expect(feedback.visualHints).not.toContain("BALL_VISIBILITY_LINE");
    expect(feedback.criteria.map((item) => item.key)).not.toContain("trajectory");
    expect(feedback.criteria.map((item) => item.key)).not.toContain("visibility");
  });
});
