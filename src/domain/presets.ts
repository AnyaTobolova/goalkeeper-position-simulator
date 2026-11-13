import type { GoalPresetId, PitchConfig, PitchPresetId } from "./types";

const adultMarkings = {
  lineWidth: 0.12,
  hasHalfwayLine: true,
  hasCenterSpot: true,
  centerCircleRadius: 9.15,
  hasPenaltyArea: true,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  hasGoalArea: true,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  hasPenaltySpot: true,
  penaltySpotDistance: 11,
  hasPenaltyArc: true,
  penaltyArcRadius: 9.15,
  hasCornerArcs: true,
  cornerArcRadius: 1
};

export const goalPresets: Record<GoalPresetId, { name: string; width: number; height: number }> = {
  mini_3x2: { name: "Сохранённые размеры 3 × 2 м", width: 3, height: 2 },
  junior_5x2: { name: "Детские / юниорские", width: 5, height: 2 },
  seven_7x2: { name: "Ворота 7 × 2 м", width: 7, height: 2 },
  adult_732x244: { name: "Взрослые", width: 7.32, height: 2.44 },
  custom: { name: "Свои размеры", width: 5, height: 2 }
};

export const pitchPresets: Record<PitchPresetId, PitchConfig> = {
  "5v5": {
    presetId: "5v5",
    goalPresetId: "junior_5x2",
    name: "5 на 5, среднее поле",
    unit: "meters",
    fieldLength: 50,
    fieldWidth: 35,
    goalWidth: 5,
    goalHeight: 2,
    freeKickDistance: 5,
    markings: {
      ...adultMarkings,
      centerCircleRadius: 5,
      penaltyAreaDepth: 10,
      penaltyAreaWidth: 20,
      goalAreaDepth: 4,
      goalAreaWidth: 10,
      penaltySpotDistance: 7,
      hasPenaltyArc: false,
      penaltyArcRadius: 5
    }
  },
  "7v7": {
    presetId: "7v7",
    goalPresetId: "junior_5x2",
    name: "7 на 7, детское поле",
    unit: "meters",
    fieldLength: 60,
    fieldWidth: 40,
    goalWidth: 5,
    goalHeight: 2,
    freeKickDistance: 7,
    markings: {
      ...adultMarkings,
      centerCircleRadius: 7,
      penaltyAreaDepth: 10,
      penaltyAreaWidth: 18,
      goalAreaDepth: 5,
      goalAreaWidth: 14,
      penaltySpotDistance: 9,
      hasPenaltyArc: false,
      penaltyArcRadius: 7
    }
  },
  "8v8": {
    presetId: "8v8",
    goalPresetId: "junior_5x2",
    name: "8 на 8, детское поле",
    unit: "meters",
    fieldLength: 60,
    fieldWidth: 42,
    goalWidth: 5,
    goalHeight: 2,
    freeKickDistance: 7,
    markings: {
      ...adultMarkings,
      centerCircleRadius: 7,
      penaltyAreaDepth: 9,
      penaltyAreaWidth: 19,
      goalAreaDepth: 5,
      goalAreaWidth: 14,
      penaltySpotDistance: 9,
      hasPenaltyArc: false,
      penaltyArcRadius: 7
    }
  },
  "9v9": {
    presetId: "9v9",
    goalPresetId: "seven_7x2",
    name: "9 на 9, юношеское поле",
    unit: "meters",
    fieldLength: 65,
    fieldWidth: 50,
    goalWidth: 7,
    goalHeight: 2,
    freeKickDistance: 8,
    markings: {
      ...adultMarkings,
      centerCircleRadius: 8,
      penaltyAreaDepth: 14,
      penaltyAreaWidth: 36,
      goalAreaDepth: 5,
      goalAreaWidth: 16,
      penaltySpotDistance: 10,
      hasPenaltyArc: false,
      penaltyArcRadius: 8
    }
  },
  "11v11": {
    presetId: "11v11",
    goalPresetId: "adult_732x244",
    name: "11 на 11, футбольное поле",
    unit: "meters",
    fieldLength: 105,
    fieldWidth: 68,
    goalWidth: 7.32,
    goalHeight: 2.44,
    freeKickDistance: 9.15,
    markings: adultMarkings
  },
  custom: {
    presetId: "custom",
    goalPresetId: "custom",
    name: "Свои размеры",
    unit: "meters",
    fieldLength: 60,
    fieldWidth: 40,
    goalWidth: 5,
    goalHeight: 2,
    freeKickDistance: 7,
    markings: {
      ...adultMarkings,
      centerCircleRadius: 7,
      penaltyAreaDepth: 13,
      penaltyAreaWidth: 28,
      goalAreaDepth: 5,
      goalAreaWidth: 14,
      penaltySpotDistance: 9,
      hasPenaltyArc: false,
      penaltyArcRadius: 7
    }
  }
};

// Старые профили остаются читаемыми: меняем только прежние стандартные
// значения, а введённые вручную размеры ворот сохраняем.
export function normalizeStoredPitch(saved: PitchConfig): PitchConfig {
  if (String(saved.presetId) === "futsal") {
    const fallback = pitchPresets["5v5"];
    return saved.goalPresetId === "custom"
      ? { ...fallback, goalPresetId: "custom", goalWidth: saved.goalWidth, goalHeight: saved.goalHeight }
      : fallback;
  }

  const oldDefault =
    (saved.presetId === "5v5" && saved.goalPresetId === "mini_3x2" && saved.goalWidth === 3 && saved.goalHeight === 2) ||
    (saved.presetId === "9v9" && saved.goalPresetId === "junior_5x2" && saved.goalWidth === 5 && saved.goalHeight === 2) ||
    (saved.presetId === "11v11" && saved.goalPresetId === "seven_7x2" && saved.goalWidth === 7 && saved.goalHeight === 2);
  const preset = pitchPresets[saved.presetId];
  if (oldDefault && preset) return preset;

  const goalPresetId = saved.goalPresetId === "mini_3x2" || (saved.goalPresetId === "adult_732x244" && saved.presetId !== "11v11") ? "custom" : saved.goalPresetId;
  if (saved.presetId !== "custom" && preset) {
    return { ...preset, goalPresetId, goalWidth: saved.goalWidth, goalHeight: saved.goalHeight, freeKickDistance: saved.freeKickDistance ?? preset.freeKickDistance };
  }
  return { ...saved, goalPresetId };
}
