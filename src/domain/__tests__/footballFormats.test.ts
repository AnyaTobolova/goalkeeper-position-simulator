import { describe, expect, it } from "vitest";
import { levels } from "../levels";
import { normalizeStoredPitch, pitchPresets } from "../presets";
import type { PitchConfig } from "../types";

describe("Форматы футбола на поле", () => {
  it("используют согласованные размеры ворот", () => {
    for (const id of ["5v5", "7v7", "8v8"] as const) {
      expect([pitchPresets[id].goalWidth, pitchPresets[id].goalHeight]).toEqual([5, 2]);
    }
    for (const id of ["9v9", "11v11"] as const) {
      expect([pitchPresets[id].goalWidth, pitchPresets[id].goalHeight]).toEqual([7, 2]);
    }
    expect("futsal" in pitchPresets).toBe(false);
  });

  it("обновляет прежние значения по умолчанию, не теряя ручные размеры", () => {
    const old5 = { ...pitchPresets["5v5"], goalPresetId: "mini_3x2" as const, goalWidth: 3, goalHeight: 2 };
    const old9 = { ...pitchPresets["9v9"], goalPresetId: "junior_5x2" as const, goalWidth: 5, goalHeight: 2 };
    const old11 = { ...pitchPresets["11v11"], goalPresetId: "adult_732x244" as const, goalWidth: 7.32, goalHeight: 2.44 };
    expect(normalizeStoredPitch(old5).goalWidth).toBe(5);
    expect(normalizeStoredPitch(old9).goalWidth).toBe(7);
    expect(normalizeStoredPitch(old11).goalWidth).toBe(7);
    const manual = { ...old9, goalPresetId: "custom" as const, goalWidth: 6.5, goalHeight: 2.1 };
    expect(normalizeStoredPitch(manual)).toMatchObject({ goalPresetId: "custom", goalWidth: 6.5, goalHeight: 2.1 });
    const customWall = { ...pitchPresets["7v7"], freeKickDistance: 6.5 };
    expect(normalizeStoredPitch(customWall).freeKickDistance).toBe(6.5);
  });

  it("переводит старый футзал в формат 5 на 5 и сохраняет ручные размеры ворот", () => {
    const legacy = { ...pitchPresets["5v5"], presetId: "futsal", goalPresetId: "mini_3x2", goalWidth: 3, goalHeight: 2 } as unknown as PitchConfig;
    expect(normalizeStoredPitch(legacy)).toMatchObject({ presetId: "5v5", goalWidth: 5, goalHeight: 2 });
    const manual = { ...legacy, goalPresetId: "custom" as const, goalWidth: 4.2, goalHeight: 2 };
    expect(normalizeStoredPitch(manual)).toMatchObject({ presetId: "5v5", goalPresetId: "custom", goalWidth: 4.2 });
  });

  it("не переключает выбранное поле для отдельных ситуаций", () => {
    expect(levels.filter((level) => level.pitchPresetOverride)).toHaveLength(0);
  });
});
