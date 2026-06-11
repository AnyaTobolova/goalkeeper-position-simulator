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
  mini_3x2: { name: "Мини-футбол / U8-U9", width: 3, height: 2 },
  junior_5x2: { name: "Детские / юниорские", width: 5, height: 2 },
  adult_732x244: { name: "Взрослые", width: 7.32, height: 2.44 },
  custom: { name: "Свои размеры", width: 5, height: 2 }
};

export const pitchPresets: Record<PitchPresetId, PitchConfig> = {
  "5v5": {
    presetId: "5v5",
    goalPresetId: "mini_3x2",
    name: "5 на 5, среднее поле",
    unit: "meters",
    fieldLength: 50,
    fieldWidth: 35,
    goalWidth: 3,
    goalHeight: 2,
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
    markings: {
      ...adultMarkings,
      centerCircleRadius: 7,
      penaltyAreaDepth: 13,
      penaltyAreaWidth: 30,
      goalAreaDepth: 5,
      goalAreaWidth: 14,
      penaltySpotDistance: 9,
      hasPenaltyArc: false,
      penaltyArcRadius: 7
    }
  },
  "9v9": {
    presetId: "9v9",
    goalPresetId: "junior_5x2",
    name: "9 на 9, юношеское поле",
    unit: "meters",
    fieldLength: 65,
    fieldWidth: 50,
    goalWidth: 5,
    goalHeight: 2,
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
    name: "11 на 11, взрослое поле",
    unit: "meters",
    fieldLength: 105,
    fieldWidth: 68,
    goalWidth: 7.32,
    goalHeight: 2.44,
    markings: adultMarkings
  },
  futsal: {
    presetId: "futsal",
    goalPresetId: "mini_3x2",
    name: "Футзал",
    unit: "meters",
    fieldLength: 40,
    fieldWidth: 20,
    goalWidth: 3,
    goalHeight: 2,
    markings: {
      ...adultMarkings,
      centerCircleRadius: 3,
      hasPenaltyArea: true,
      penaltyAreaDepth: 6,
      penaltyAreaWidth: 16,
      hasGoalArea: false,
      goalAreaDepth: undefined,
      goalAreaWidth: undefined,
      penaltySpotDistance: 6,
      penaltyArcRadius: 6,
      hasPenaltyArc: false
    }
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
