import { describe, expect, it } from "vitest";
import { evaluateGoalkeeper } from "../evaluate";
import { facingAngleToBall, toMeters } from "../geometry";
import { levels } from "../levels";
import { fromLocal, toLocal, buildPositionZones } from "../positionZones";
import { pitchPresets } from "../presets";

describe("Направление корпуса и отображение зон", () => {
  it("учитывает соотношение ширины и длины поля при повороте к мячу", () => {
    const pitch = { ...pitchPresets["7v7"], fieldWidth: 30, fieldLength: 120 };
    const keeper = { x: 50, y: 2 };
    const ball = { x: 70, y: 22 };
    const expected = Math.atan2(6, 24) * 180 / Math.PI;
    expect(facingAngleToBall(keeper, ball, pitch)).toBeCloseTo(expected, 8);
    const level = { ...levels[0], ball };
    expect(evaluateGoalkeeper(keeper, level, pitch, expected).orientationScore).toBe(100);
  });

  it("углы и размеры видимой зоны совпадают с осями оценки на разных полях", () => {
    for (const pitch of [pitchPresets["5v5"], pitchPresets["7v7"], pitchPresets["9v9"], pitchPresets["11v11"]]) {
      for (const id of ["angle-right-half", "depth-long-center", "corner-right-near-post", "penalty-center"]) {
        const level = levels.find((item) => item.id === id)!;
        const zones = buildPositionZones(level, pitch);
        const shown = zones.correct;
        const fieldHeight = Math.max(64, pitch.fieldLength / pitch.fieldWidth * 100);
        const center = toMeters(shown.center, pitch);
        const centerLocal = toLocal(center, zones.center, zones.axes);
        const halfWidth = shown.sideHalf;
        const halfHeight = shown.depthHalf * fieldHeight / 100;
        const theta = shown.angle * Math.PI / 180;
        const sideSign = Math.sign(zones.axes.px * zones.axes.uy - zones.axes.py * zones.axes.ux);
        for (const du of [-1, 1]) for (const dv of [-1, 1]) {
          const x = sideSign * dv * halfWidth;
          const y = -du * halfHeight;
          const drawnX = shown.center.x + Math.cos(theta) * x - Math.sin(theta) * y;
          const drawnY = (100 - shown.center.y) * fieldHeight / 100 + Math.sin(theta) * x + Math.cos(theta) * y;
          const actual = fromLocal({
            u: centerLocal.u + du * shown.depthHalf * pitch.fieldLength / 100,
            v: centerLocal.v + dv * shown.sideHalf * pitch.fieldWidth / 100
          }, zones.center, zones.axes);
          expect(drawnX).toBeCloseTo(actual.x / pitch.fieldWidth * 100, 7);
          expect(drawnY).toBeCloseTo(fieldHeight - actual.y / pitch.fieldLength * fieldHeight, 7);
        }
      }
    }
  });
});
