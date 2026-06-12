import type { ErrorType, Level, PitchConfig, Point, ZoneConfig } from "./types";
import { clamp, distancePointToLine, fromMeters, goalCenter, leftPost, rightPost, toMeters } from "./geometry";
import { inferScenarioType } from "./scenarios";

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
  high_cross: {
    idealDepth: 3.2,
    correctDepthHalf: 1.4,
    correctSideHalf: 1.4,
    backSlack: 2.4,
    forwardSlack: 1.1,
    sideSlack: 2
  },
  corner: {
    idealDepth: 2.8,
    correctDepthHalf: 1.2,
    correctSideHalf: 1.5,
    backSlack: 2.1,
    forwardSlack: 1,
    sideSlack: 2
  },
  free_kick: {
    idealDepth: 3.4,
    correctDepthHalf: 1.4,
    correctSideHalf: 1.4,
    backSlack: 2.4,
    forwardSlack: 1.2,
    sideSlack: 2
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

export function getZoneConfig(level: Level, pitch: PitchConfig): ZoneConfig {
  const ball = toMeters(level.ball, pitch);
  const distance = ball.y;
  const scenarioType = inferScenarioType(level, pitch);

  if (scenarioType === "one_v_one_loose_touch") {
    return { ...zoneConfigs.one_v_one_loose_touch, idealDepth: clamp(distance * 0.46, 7, Math.max(7, distance - 2.2)) };
  }

  if (scenarioType === "one_v_one") {
    return { ...zoneConfigs.one_v_one, idealDepth: clamp(distance * 0.42, 5.5, Math.max(6, distance - 2.4)) };
  }

  if (scenarioType === "cross_goal" || scenarioType === "high_cross" || scenarioType === "corner" || scenarioType === "free_kick") {
    const baseConfig = zoneConfigs[scenarioType];
    const targetDepth = level.correctZone ? ((level.correctZone.yMin + level.correctZone.yMax) / 2 / 100) * pitch.fieldLength : baseConfig.idealDepth;
    return { ...baseConfig, idealDepth: targetDepth };
  }

  if (scenarioType === "long_shot" && distance >= 55) {
    return { ...zoneConfigs.sweeper_position, idealDepth: clamp(distance * 0.24, 10, 14) };
  }

  if (scenarioType === "long_shot") {
    return { ...zoneConfigs.long_shot, idealDepth: clamp(distance * 0.24, 6.5, 9.5) };
  }

  if (scenarioType === "close_shot") {
    return { ...zoneConfigs.close_shot, idealDepth: clamp(distance * 0.34, 3.4, 5.2) };
  }

  if (scenarioType === "side_shot" || scenarioType === "sharp_angle" || scenarioType === "defender_pressure" || scenarioType === "pass_or_cutback") {
    return { ...zoneConfigs[scenarioType], idealDepth: clamp(distance * 0.28, 3.2, 6.4) };
  }

  if (scenarioType === "sweeper_position") {
    return { ...zoneConfigs.sweeper_position, idealDepth: clamp(distance * 0.24, 10, 14) };
  }

  return { ...zoneConfigs.central_shot, idealDepth: clamp(distance * 0.26, 4.8, 7.2) };
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

export function buildPositionZones(level: Level, pitch: PitchConfig) {
  const ball = toMeters(level.ball, pitch);
  const center = goalCenter(pitch);
  const axes = getLocalAxes(ball, center);
  const baseCfg = getZoneConfig(level, pitch);
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
