import { describe, expect, it } from "vitest";
import { openGoalShare } from "../geometry";
import { openGoalSegments, openGoalSegmentsWithWall } from "../openGoalSegments";
import { pitchPresets } from "../presets";

describe("Открытые отрезки ворот", () => {
  it("совпадают с существующим процентом для разных положений и размеров ворот", () => {
    for (const pitch of Object.values(pitchPresets)) {
      for (const ball of [{ x: pitch.fieldWidth / 2, y: 20 }, { x: pitch.fieldWidth * 0.2, y: 12 }, { x: pitch.fieldWidth * 0.8, y: 0.1 }]) {
        for (const keeper of [{ x: pitch.fieldWidth / 2, y: 0 }, { x: pitch.fieldWidth * 0.3, y: 4 }, { x: pitch.fieldWidth / 2, y: 25 }]) {
          const length = openGoalSegments(ball, keeper, pitch).reduce((sum, [left, right]) => sum + right - left, 0);
          expect(length / pitch.goalWidth).toBeCloseTo(openGoalShare(ball, keeper, pitch), 10);
        }
      }
    }
  });

  it("учитывают стенку между мячом и воротами без повторного вычитания перекрытий", () => {
    const pitch = pitchPresets["7v7"];
    const center = pitch.fieldWidth / 2;
    const ball = { x: center, y: 20 };
    const keeper = { x: center, y: 0 };
    const withoutWall = openGoalSegments(ball, keeper, pitch);
    const length = (segments: [number, number][]) => segments.reduce((sum, [start, end]) => sum + end - start, 0);
    expect(openGoalSegmentsWithWall(ball, keeper, pitch, { x: center, y: 10, count: 0 })).toEqual(withoutWall);
    expect(openGoalSegmentsWithWall(ball, keeper, pitch, { x: center, y: 21, count: 4 })).toEqual(withoutWall);
    expect(openGoalSegmentsWithWall(ball, keeper, pitch, { x: center, y: 10, count: 2 })).toEqual(withoutWall);
    const wallOnLeft = openGoalSegmentsWithWall(ball, keeper, pitch, { x: center - 1.5, y: 10, count: 2 });
    expect(length(wallOnLeft)).toBeLessThan(length(withoutWall));
    expect(length(wallOnLeft)).toBeCloseTo(length(withoutWall) - 0.5, 10);
  });
});
