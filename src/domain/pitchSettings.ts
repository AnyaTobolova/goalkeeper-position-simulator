import type { PitchConfig } from "./types";
import { levels } from "./levels";

const rounded = (value: number) => Math.round(value * 100) / 100;

// При ручном изменении размера поля сохраняем пропорции разметки выбранного
// пресета. Это приблизительная схема, не регламент конкретного турнира.
export function resizePitch(pitch: PitchConfig, key: "fieldLength" | "fieldWidth", value: number): PitchConfig {
  const factor = value / pitch[key];
  const scale = (n: number | undefined) => n === undefined ? undefined : rounded(n * factor);
  const next = { ...pitch, presetId: "custom" as const, [key]: value, freeKickDistance: pitch.freeKickDistance ?? pitch.markings.penaltyArcRadius ?? 9.15, markings: { ...pitch.markings } };
  if (key === "fieldWidth") {
    next.markings.penaltyAreaWidth = scale(pitch.markings.penaltyAreaWidth);
    next.markings.goalAreaWidth = scale(pitch.markings.goalAreaWidth);
  } else {
    next.markings.penaltyAreaDepth = scale(pitch.markings.penaltyAreaDepth);
    next.markings.goalAreaDepth = scale(pitch.markings.goalAreaDepth);
    next.markings.penaltySpotDistance = scale(pitch.markings.penaltySpotDistance);
    next.markings.penaltyArcRadius = scale(pitch.markings.penaltyArcRadius);
  }
  if (next.markings.centerCircleRadius !== undefined) {
    next.markings.centerCircleRadius = Math.min(next.markings.centerCircleRadius, next.fieldWidth / 2, next.fieldLength / 2);
  }
  return next;
}

export function pitchSettingsError(pitch: PitchConfig): string | null {
  const { fieldWidth, fieldLength, goalWidth, goalHeight, markings } = pitch;
  if (![fieldWidth, fieldLength, goalWidth, goalHeight].every(Number.isFinite)) return "Проверьте размеры: нужны конечные числа.";
  if (fieldLength < 20 || fieldWidth < 15) return "Длина поля должна быть не меньше 20 м, ширина — не меньше 15 м.";
  if (fieldLength <= fieldWidth) return "Длина поля должна быть больше его ширины.";
  if (goalWidth < 2 || goalHeight < 1.5) return "Ширина ворот должна быть не меньше 2 м, высота — не меньше 1,5 м.";
  if (goalWidth >= fieldWidth) return "Ворота должны быть уже поля.";
  if (goalHeight >= goalWidth) return "Высота ворот должна быть меньше их ширины.";
  const wallDistance = pitch.freeKickDistance ?? markings.penaltyArcRadius ?? 9.15;
  if (!Number.isFinite(wallDistance) || wallDistance < 1 || wallDistance >= fieldLength / 2) {
    return "Дистанция стенки должна быть не меньше 1 м и меньше половины длины поля.";
  }
  // Учитываем максимальный сдвиг мяча при повторе: иначе стенка в одном
  // из имеющихся заданий окажется за линией ворот.
  const nearestFreeKick = Math.min(...levels.filter((level) => level.freeKick).map((level) => {
    const ballOffset = Math.abs(level.ball.x - 50) / 100 * fieldWidth;
    const sideways = Math.max(0, Math.abs(ballOffset - goalWidth / 2) - 0.03 * fieldWidth);
    const depth = Math.max(3, level.ball.y - 2.5) / 100 * fieldLength;
    return Math.hypot(sideways, depth);
  }));
  if (wallDistance >= nearestFreeKick) {
    return "Дистанция стенки слишком велика для ближайшего штрафного. Увеличьте поле или уменьшите дистанцию.";
  }
  if (markings.hasPenaltyArea && (markings.penaltyAreaWidth === undefined || markings.penaltyAreaWidth > fieldWidth || markings.penaltyAreaWidth < goalWidth)) {
    return "Штрафная должна помещаться на поле и быть шире ворот. Измените размер поля или ворот.";
  }
  if (markings.hasPenaltyArea && (markings.penaltyAreaDepth === undefined || markings.penaltyAreaDepth > fieldLength / 2 || markings.penaltyAreaDepth <= 0)) {
    return "Штрафная должна помещаться на половине поля.";
  }
  if (markings.hasGoalArea && (markings.goalAreaWidth === undefined || markings.goalAreaWidth < goalWidth || markings.goalAreaWidth > (markings.penaltyAreaWidth ?? fieldWidth))) {
    return "Вратарская должна быть шире ворот и помещаться в штрафной. Измените размер поля или ворот.";
  }
  if (markings.hasGoalArea && (markings.goalAreaDepth === undefined || markings.goalAreaDepth > (markings.penaltyAreaDepth ?? fieldLength / 2))) {
    return "Вратарская должна помещаться в штрафной.";
  }
  if (markings.hasPenaltySpot && (markings.penaltySpotDistance === undefined || markings.penaltySpotDistance <= 0 || markings.penaltySpotDistance > (markings.penaltyAreaDepth ?? fieldLength / 2))) {
    return "Точка пенальти должна находиться внутри штрафной.";
  }
  return null;
}
