import type { ErrorType, Level, PitchConfig, Point, ScenarioType, ZoneConfig } from "./types";
import { clamp, distancePointToLine, fromMeters, goalCenter, leftPost, rightPost, toMeters } from "./geometry";
import { goalAnchoredScenarios, inferScenarioType, inferShotScenarioType } from "./scenarios";

export type LocalAxes = {
  ux: number;
  uy: number;
  px: number;
  py: number;
};

export type LocalPosition = {
  u: number;
  v: number;
};

export type ZoneClassification = {
  status: "correct" | "almost" | "needs_fix" | "wrong" | "dangerous";
  errorType?: ErrorType;
};

export const zoneConfigs = {
  central_shot: {
    idealDepth: 6,
    correctDepthHalf: 2,
    correctSideHalf: 1.4,
    backSlack: 4,
    forwardSlack: 2,
    sideSlack: 2.2
  },
  side_shot: {
    idealDepth: 5.5,
    correctDepthHalf: 1.8,
    correctSideHalf: 1.3,
    backSlack: 3.8,
    forwardSlack: 1.8,
    sideSlack: 2
  },
  sharp_angle: {
    idealDepth: 4.2,
    correctDepthHalf: 1.6,
    correctSideHalf: 1.1,
    backSlack: 3,
    forwardSlack: 1.2,
    sideSlack: 1.8
  },
  long_shot: {
    idealDepth: 8,
    correctDepthHalf: 2.4,
    correctSideHalf: 1.6,
    backSlack: 4.5,
    forwardSlack: 2.5,
    sideSlack: 2.4
  },
  close_shot: {
    idealDepth: 4.5,
    correctDepthHalf: 1.6,
    correctSideHalf: 1.3,
    backSlack: 3,
    forwardSlack: 1.2,
    sideSlack: 1.8
  },
  one_v_one: {
    idealDepth: 7,
    correctDepthHalf: 2,
    correctSideHalf: 1.5,
    backSlack: 3,
    forwardSlack: 1.8,
    sideSlack: 2
  },
  one_v_one_loose_touch: {
    idealDepth: 8,
    correctDepthHalf: 2.2,
    correctSideHalf: 1.5,
    backSlack: 3,
    forwardSlack: 2.6,
    sideSlack: 2
  },
  sweeper_position: {
    idealDepth: 14,
    correctDepthHalf: 3,
    correctSideHalf: 2,
    backSlack: 5,
    forwardSlack: 3,
    sideSlack: 2.5
  },
  defender_pressure: {
    idealDepth: 5.8,
    correctDepthHalf: 1.8,
    correctSideHalf: 1.5,
    backSlack: 3.6,
    forwardSlack: 1.6,
    sideSlack: 2.1
  },
  pass_or_cutback: {
    idealDepth: 5,
    correctDepthHalf: 1.7,
    correctSideHalf: 1.4,
    backSlack: 3.4,
    forwardSlack: 1.5,
    sideSlack: 2
  },
  cross_goal: {
    idealDepth: 3.8,
    correctDepthHalf: 1.4,
    correctSideHalf: 1.2,
    backSlack: 2.7,
    forwardSlack: 1.1,
    sideSlack: 1.8
  },
  // Стандарты ниже строятся в осях ворот: idealDepth - метры от линии ворот,
  // боковые допуски - метры от целевой точки на линии ворот.
  high_cross: {
    idealDepth: 1.4,
    correctDepthHalf: 0.8,
    correctSideHalf: 1,
    backSlack: 1.1,
    forwardSlack: 1.2,
    sideSlack: 1.7
  },
  corner: {
    idealDepth: 0.9,
    correctDepthHalf: 0.7,
    correctSideHalf: 0.9,
    backSlack: 0.6,
    forwardSlack: 1.1,
    sideSlack: 1.6
  },
  free_kick: {
    idealDepth: 2.2,
    correctDepthHalf: 1,
    correctSideHalf: 0.9,
    backSlack: 1.6,
    forwardSlack: 1.2,
    sideSlack: 1.5
  },
  penalty: {
    idealDepth: 0.35,
    correctDepthHalf: 0.45,
    correctSideHalf: 0.8,
    backSlack: 0.5,
    forwardSlack: 0.7,
    sideSlack: 1.2
  },
  conservative: {
    idealDepth: 3.4,
    correctDepthHalf: 1.4,
    correctSideHalf: 1.4,
    backSlack: 2.4,
    forwardSlack: 1.2,
    sideSlack: 2
  }
} satisfies Record<string, ZoneConfig>;

export function getLocalAxes(ball: Point, center: Point): LocalAxes {
  const dx = ball.x - center.x;
  const dy = ball.y - center.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;

  return {
    ux,
    uy,
    px: -uy,
    py: ux
  };
}

export function toLocal(point: Point, center: Point, axes: LocalAxes): LocalPosition {
  const rx = point.x - center.x;
  const ry = point.y - center.y;

  return {
    u: rx * axes.ux + ry * axes.uy,
    v: rx * axes.px + ry * axes.py
  };
}

export function fromLocal(local: LocalPosition, center: Point, axes: LocalAxes): Point {
  return {
    x: center.x + axes.ux * local.u + axes.px * local.v,
    y: center.y + axes.uy * local.u + axes.py * local.v
  };
}

// Чем меньше ворота, тем ближе к линии рабочая глубина вратаря:
// маленькие ворота перекрываются с меньшим выходом, а переброс и обводка опаснее.
// Эталон - юниорские ворота 5 м.
export function goalDepthScale(pitch: PitchConfig) {
  return clamp(pitch.goalWidth / 5, 0.75, 1.35);
}

// Боковые допуски стандартов тоже сужаются на маленьких воротах.
function goalSideScale(pitch: PitchConfig) {
  return clamp(pitch.goalWidth / 5, 0.7, 1.4);
}

// Тип сценария для расчета глубины: реакционные уровни используют
// геометрию точки мяча, а не собственный тип reaction_to_ball_owner.
function depthScenarioType(level: Level, pitch: PitchConfig): ScenarioType {
  const scenarioType = inferScenarioType(level, pitch);

  if (scenarioType === "reaction_to_ball_owner") {
    return inferShotScenarioType(level.ball, pitch);
  }

  return scenarioType;
}

// Ограничение сверху: вратарь не подходит к мячу вплотную,
// каким бы ни был размер ворот.
function capByBallDistance(depth: number, distance: number, gap: number) {
  return Math.min(depth, Math.max(1.5, distance - gap));
}

export function getZoneConfig(level: Level, pitch: PitchConfig): ZoneConfig {
  const ball = toMeters(level.ball, pitch);
  const distance = ball.y;
  const scenarioType = inferScenarioType(level, pitch);
  const s = goalDepthScale(pitch);

  if (goalAnchoredScenarios.has(scenarioType)) {
    const baseConfig = zoneConfigs[scenarioType as "corner" | "high_cross" | "free_kick" | "penalty"];
    const sideScale = goalSideScale(pitch);

    return {
      ...baseConfig,
      idealDepth: level.goalTarget?.depth ?? baseConfig.idealDepth,
      correctSideHalf: baseConfig.correctSideHalf * sideScale,
      sideSlack: baseConfig.sideSlack * sideScale
    };
  }

  const shotType = depthScenarioType(level, pitch);

  if (shotType === "one_v_one_loose_touch") {
    return { ...zoneConfigs.one_v_one_loose_touch, idealDepth: clamp(distance * 0.46 * s, 7 * s, Math.max(7 * s, distance - 2.2)) };
  }

  if (shotType === "one_v_one") {
    return { ...zoneConfigs.one_v_one, idealDepth: clamp(distance * 0.42 * s, 5.5 * s, Math.max(6 * s, distance - 2.4)) };
  }

  if (shotType === "cross_goal") {
    return { ...zoneConfigs.cross_goal, idealDepth: capByBallDistance(clamp(distance * 0.3 * s, 2.4 * s, 4.4 * s), distance, 1.5) };
  }

  if (shotType === "long_shot" && distance >= 55) {
    return { ...zoneConfigs.sweeper_position, idealDepth: clamp(distance * 0.24, 10, 14) };
  }

  if (shotType === "long_shot") {
    return { ...zoneConfigs.long_shot, idealDepth: clamp(distance * 0.24 * s, 6.5 * s, 9.5 * s) };
  }

  if (shotType === "close_shot") {
    return { ...zoneConfigs.close_shot, idealDepth: capByBallDistance(clamp(distance * 0.34 * s, 3.4 * s, 5.2 * s), distance, 1.6) };
  }

  if (shotType === "side_shot" || shotType === "sharp_angle" || shotType === "defender_pressure" || shotType === "pass_or_cutback") {
    return { ...zoneConfigs[shotType], idealDepth: capByBallDistance(clamp(distance * 0.28 * s, 3.2 * s, 6.4 * s), distance, 1.6) };
  }

  if (shotType === "sweeper_position") {
    return { ...zoneConfigs.sweeper_position, idealDepth: clamp(distance * 0.24, 10, 14) };
  }

  return { ...zoneConfigs.central_shot, idealDepth: clamp(distance * 0.26 * s, 4.8 * s, 7.2 * s) };
}

export function getIdealPoint(center: Point, axes: LocalAxes, idealDepth: number): Point {
  return fromLocal({ u: idealDepth, v: 0 }, center, axes);
}

export function isCorrect(local: LocalPosition, cfg: ZoneConfig) {
  return Math.abs(local.u - cfg.idealDepth) <= cfg.correctDepthHalf && Math.abs(local.v) <= cfg.correctSideHalf;
}

export function isAlmost(local: LocalPosition, cfg: ZoneConfig) {
  return local.u >= cfg.idealDepth - cfg.backSlack && local.u <= cfg.idealDepth + cfg.forwardSlack && Math.abs(local.v) <= cfg.sideSlack;
}

export function warningDepthBuffer(cfg: ZoneConfig) {
  return Math.max(0.8, Math.min(1.8, cfg.correctDepthHalf * 0.65));
}

export function isWarningTooHigh(local: LocalPosition, cfg: ZoneConfig) {
  const warningEnd = cfg.idealDepth + cfg.forwardSlack + warningDepthBuffer(cfg);
  return local.u > cfg.idealDepth + cfg.forwardSlack && local.u <= warningEnd && Math.abs(local.v) <= cfg.sideSlack + 0.8;
}

export function isWarningTooDeep(local: LocalPosition, cfg: ZoneConfig) {
  const warningStart = cfg.idealDepth - cfg.backSlack - warningDepthBuffer(cfg);
  return local.u < cfg.idealDepth - cfg.backSlack && local.u >= warningStart && Math.abs(local.v) <= cfg.sideSlack + 0.8;
}

export function isTooHigh(local: LocalPosition, cfg: ZoneConfig) {
  return local.u > cfg.idealDepth + cfg.forwardSlack + warningDepthBuffer(cfg) && Math.abs(local.v) <= cfg.sideSlack + 0.8;
}

export function isTooDeep(local: LocalPosition, cfg: ZoneConfig) {
  return local.u < cfg.idealDepth - cfg.backSlack - warningDepthBuffer(cfg) && Math.abs(local.v) <= cfg.sideSlack + 0.8;
}

export function isTooLeft(local: LocalPosition, cfg: ZoneConfig) {
  return local.v < -cfg.sideSlack && local.u >= cfg.idealDepth - cfg.backSlack && local.u <= cfg.idealDepth + cfg.forwardSlack;
}

export function isTooRight(local: LocalPosition, cfg: ZoneConfig) {
  return local.v > cfg.sideSlack && local.u >= cfg.idealDepth - cfg.backSlack && local.u <= cfg.idealDepth + cfg.forwardSlack;
}

export function isInsideShotAngle(point: Point, ball: Point, pitch: PitchConfig, tolerance = 0.04) {
  const left = leftPost(pitch);
  const right = rightPost(pitch);
  const sign = (a: Point, b: Point, c: Point) => (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
  const d1 = sign(point, ball, left);
  const d2 = sign(point, left, right);
  const d3 = sign(point, right, ball);
  const hasNegative = d1 < -tolerance || d2 < -tolerance || d3 < -tolerance;
  const hasPositive = d1 > tolerance || d2 > tolerance || d3 > tolerance;

  return !(hasNegative && hasPositive);
}

export function classifyLocalPosition(local: LocalPosition, cfg: ZoneConfig, insideShotAngle = true): ZoneClassification {
  if (!insideShotAngle) {
    return { status: "wrong", errorType: local.v < 0 ? "TOO_LEFT" : "TOO_RIGHT" };
  }

  if (isCorrect(local, cfg)) {
    return { status: "correct" };
  }

  if (isAlmost(local, cfg)) {
    return { status: "almost" };
  }

  if (isWarningTooHigh(local, cfg)) {
    return { status: "needs_fix", errorType: "TOO_HIGH" };
  }

  if (isWarningTooDeep(local, cfg)) {
    return { status: "needs_fix", errorType: "TOO_DEEP" };
  }

  if (isTooHigh(local, cfg)) {
    return { status: "dangerous", errorType: "TOO_HIGH" };
  }

  if (isTooDeep(local, cfg)) {
    return { status: "dangerous", errorType: "TOO_DEEP" };
  }

  if (isTooLeft(local, cfg)) {
    return { status: "wrong", errorType: "TOO_LEFT" };
  }

  if (isTooRight(local, cfg)) {
    return { status: "wrong", errorType: "TOO_RIGHT" };
  }

  return { status: "wrong" };
}

export function localZoneToPercent(center: Point, axes: LocalAxes, pitch: PitchConfig, uMin: number, uMax: number, sideHalf: number) {
  const centerMeters = fromLocal({ u: (uMin + uMax) / 2, v: 0 }, center, axes);
  const centerPercent = fromMeters(centerMeters, pitch);
  const depthHalfMeters = (uMax - uMin) / 2;
  const angle = (Math.atan2(axes.ux * pitch.fieldLength, axes.uy * pitch.fieldWidth) * 180) / Math.PI;

  return {
    center: centerPercent,
    depthHalf: (depthHalfMeters / pitch.fieldLength) * 100,
    sideHalf: (sideHalf / pitch.fieldWidth) * 100,
    angle
  };
}

function shotCorridorHalf(ball: Point, center: Point, axes: LocalAxes, pitch: PitchConfig, uMin: number, uMax: number, safety = 0.54) {
  const left = leftPost(pitch);
  const right = rightPost(pitch);
  const sampleDepths = [uMin, uMin * 0.67 + uMax * 0.33, (uMin + uMax) / 2, uMin * 0.33 + uMax * 0.67, uMax].filter((u) => u > 0);
  const minDistance = sampleDepths.reduce((currentMin, u) => {
    const point = fromLocal({ u, v: 0 }, center, axes);
    const leftDistance = distancePointToLine(point, ball, left);
    const rightDistance = distancePointToLine(point, ball, right);

    return Math.min(currentMin, leftDistance, rightDistance);
  }, Number.POSITIVE_INFINITY);

  return Math.max(0.32, minDistance * safety);
}

function cappedZoneToPercent(center: Point, axes: LocalAxes, pitch: PitchConfig, ball: Point, uMin: number, uMax: number, sideHalf: number) {
  const cappedSide = cappedSideHalf(ball, center, axes, pitch, uMin, uMax, sideHalf);

  return localZoneToPercent(center, axes, pitch, uMin, uMax, cappedSide);
}

function cappedSideHalf(ball: Point, center: Point, axes: LocalAxes, pitch: PitchConfig, uMin: number, uMax: number, sideHalf: number, safety = 0.54) {
  return Math.min(sideHalf, shotCorridorHalf(ball, center, axes, pitch, uMin, uMax, safety));
}

// Позиция по умолчанию для стандартов, если уровень не задал goalTarget.
function defaultGoalTargetSide(scenarioType: ScenarioType, level: Level): number {
  const ballRight = level.ball.x >= 50;

  if (scenarioType === "corner") {
    // Открытое поле: стойка между серединой ворот и дальней штангой.
    return ballRight ? -0.35 : 0.35;
  }

  if (scenarioType === "free_kick") {
    // Стенка закрывает ближний угол, вратарь отвечает за открытую часть.
    return ballRight ? -0.45 : 0.45;
  }

  return 0;
}

// Оси ворот: u - метры от линии ворот вглубь поля, v - метры вправо от целевой точки.
const goalAxes: LocalAxes = { ux: 0, uy: 1, px: 1, py: 0 };

function buildGoalAnchoredZones(level: Level, pitch: PitchConfig, cfg: ZoneConfig, scenarioType: ScenarioType) {
  const center = goalCenter(pitch);
  const side = level.goalTarget?.side ?? defaultGoalTargetSide(scenarioType, level);
  let anchorX = center.x + (side * pitch.goalWidth) / 2;

  // При штрафном вратарь закрывает открытую часть сектора удара.
  // Сектор сужается от ворот к мячу, поэтому на рабочей глубине точка
  // не должна выходить за линию мяч - дальняя штанга.
  if (scenarioType === "free_kick" || scenarioType === "penalty") {
    const ball = toMeters(level.ball, pitch);

    if (ball.y > 0.5) {
      const t = clamp(cfg.idealDepth / ball.y, 0, 1);
      const leftEdge = leftPost(pitch).x * (1 - t) + ball.x * t;
      const rightEdge = rightPost(pitch).x * (1 - t) + ball.x * t;
      const margin = 0.3;
      anchorX = clamp(anchorX, Math.min(leftEdge, rightEdge) + margin, Math.max(leftEdge, rightEdge) - margin);
    }
  }

  const anchor = { x: anchorX, y: 0 };
  const ideal = { x: anchor.x, y: cfg.idealDepth };
  const correctUMin = Math.max(0, cfg.idealDepth - cfg.correctDepthHalf);
  const correctUMax = cfg.idealDepth + cfg.correctDepthHalf;
  const almostUMin = Math.max(0, cfg.idealDepth - cfg.backSlack);
  const almostUMax = cfg.idealDepth + cfg.forwardSlack;
  const warningDepth = warningDepthBuffer(cfg);
  const tooDeepMax = cfg.idealDepth - cfg.backSlack - warningDepth;
  const tooHighMin = cfg.idealDepth + cfg.forwardSlack + warningDepth;

  return {
    cfg,
    axes: goalAxes,
    center: anchor,
    ideal,
    correct: localZoneToPercent(anchor, goalAxes, pitch, correctUMin, correctUMax, cfg.correctSideHalf),
    almost: localZoneToPercent(anchor, goalAxes, pitch, almostUMin, almostUMax, cfg.sideSlack),
    tooDeep: tooDeepMax > 0 ? localZoneToPercent(anchor, goalAxes, pitch, Math.max(0, tooDeepMax - 4), tooDeepMax, cfg.sideSlack + 0.8) : undefined,
    tooHigh: localZoneToPercent(anchor, goalAxes, pitch, tooHighMin, tooHighMin + 4, cfg.sideSlack + 0.8)
  };
}

export function buildPositionZones(level: Level, pitch: PitchConfig) {
  const ball = toMeters(level.ball, pitch);
  const center = goalCenter(pitch);
  const scenarioType = inferScenarioType(level, pitch);
  const anchoredCfg = getZoneConfig(level, pitch);

  if (goalAnchoredScenarios.has(scenarioType)) {
    return buildGoalAnchoredZones(level, pitch, anchoredCfg, scenarioType);
  }

  const axes = getLocalAxes(ball, center);
  const baseCfg = anchoredCfg;
  const correctUMin = baseCfg.idealDepth - baseCfg.correctDepthHalf;
  const correctUMax = baseCfg.idealDepth + baseCfg.correctDepthHalf;
  const correctSideHalf = cappedSideHalf(ball, center, axes, pitch, correctUMin, correctUMax, baseCfg.correctSideHalf, 0.6);
  const minAlmostDepth = Math.max(1.4, Math.min(2.2, pitch.goalWidth * 0.35));
  const preferredAlmostDepthHalf = baseCfg.correctDepthHalf + Math.min(0.9, Math.max(0.45, baseCfg.correctDepthHalf * 0.45));
  const almostDepthHalf = Math.max(baseCfg.correctDepthHalf, Math.min(preferredAlmostDepthHalf, Math.max(baseCfg.correctDepthHalf, baseCfg.idealDepth - minAlmostDepth)));
  const almostUMin = baseCfg.idealDepth - almostDepthHalf;
  const almostUMax = baseCfg.idealDepth + almostDepthHalf;
  const desiredSideSlack = Math.max(correctSideHalf * 1.28, Math.min(baseCfg.sideSlack, correctSideHalf + 0.7));
  const sideSlack = Math.max(correctSideHalf + 0.22, correctSideHalf * 1.16, cappedSideHalf(ball, center, axes, pitch, almostUMin, almostUMax, desiredSideSlack, 0.5));
  const cfg = { ...baseCfg, backSlack: almostDepthHalf, forwardSlack: almostDepthHalf, correctSideHalf, sideSlack };
  const ideal = getIdealPoint(center, axes, cfg.idealDepth);
  const warningDepth = warningDepthBuffer(cfg);
  const tooDeepMax = cfg.idealDepth - cfg.backSlack - warningDepth;
  const tooHighMin = cfg.idealDepth + cfg.forwardSlack + warningDepth;

  return {
    cfg,
    axes,
    center,
    ideal,
    correct: localZoneToPercent(center, axes, pitch, correctUMin, correctUMax, correctSideHalf),
    almost: localZoneToPercent(center, axes, pitch, almostUMin, almostUMax, sideSlack),
    tooDeep: cappedZoneToPercent(center, axes, pitch, ball, Math.max(0, tooDeepMax - 4), tooDeepMax, cfg.sideSlack + 0.8),
    tooHigh: cappedZoneToPercent(center, axes, pitch, ball, tooHighMin, tooHighMin + 4, cfg.sideSlack + 0.8)
  };
}
