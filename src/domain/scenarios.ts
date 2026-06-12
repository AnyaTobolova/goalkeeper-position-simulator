import type { Level, PitchConfig, Point, ScenarioType } from "./types";
import { goalCenter, toMeters } from "./geometry";

export type CriterionKey =
  | "line"
  | "depth"
  | "shootingAngle"
  | "nearPost"
  | "farPost"
  | "readiness"
  | "tooHighRisk"
  | "controlledExit"
  | "adjustment"
  | "newBallLine"
  | "trajectory"
  | "visibility"
  | "goalControl"
  | "startingPosition"
  | "wall"
  | "openGoalPart"
  | "defenderHelp"
  | "spaceControl";

export type BallSide = "left" | "center" | "right";

export const depthRelatedCriteria = new Set<CriterionKey>(["depth", "tooHighRisk", "controlledExit", "goalControl", "startingPosition", "spaceControl"]);
export const depthDangerErrors = new Set(["TOO_DEEP", "TOO_HIGH", "PASSIVE_1V1", "RUSHED_1V1"]);

// Red field zones are scenario explanations for depth errors only.
// Line, near-post, wall, visibility and repositioning mistakes use their own visual hints.
export const criteriaByScenarioType: Record<ScenarioType, CriterionKey[]> = {
  central_shot: ["line", "depth", "shootingAngle", "readiness"],
  side_shot: ["line", "depth", "nearPost", "readiness"],
  sharp_angle: ["line", "depth", "nearPost", "farPost"],
  long_shot: ["line", "depth", "readiness", "tooHighRisk"],
  close_shot: ["line", "depth", "readiness", "tooHighRisk"],
  one_v_one: ["line", "depth", "controlledExit", "readiness"],
  one_v_one_loose_touch: ["line", "depth", "controlledExit", "readiness"],
  pass_or_cutback: ["adjustment", "newBallLine", "depth", "readiness"],
  cross_goal: ["adjustment", "nearPost", "farPost", "readiness"],
  high_cross: ["trajectory", "visibility", "depth", "goalControl"],
  corner: ["trajectory", "visibility", "goalControl", "startingPosition"],
  free_kick: ["wall", "visibility", "openGoalPart", "depth"],
  defender_pressure: ["line", "depth", "defenderHelp", "readiness"],
  sweeper_position: ["depth", "spaceControl", "line", "readiness"]
};

export function getBallSide(ball: Point, goal: Point): BallSide {
  const dx = ball.x - goal.x;

  if (Math.abs(dx) < 5) {
    return "center";
  }

  return dx > 0 ? "right" : "left";
}

export function inferScenarioType(level: Level, pitch: PitchConfig): ScenarioType {
  if (level.scenarioType) {
    return level.scenarioType;
  }

  if (level.freeKick || level.category === "free_kick") {
    return "free_kick";
  }

  if (level.category === "corner") {
    return "corner";
  }

  if (level.category === "cross") {
    return "high_cross";
  }

  if (level.category === "pass_reposition") {
    return level.id.includes("cross") || level.id.includes("cutback") ? "cross_goal" : "pass_or_cutback";
  }

  if (level.category === "one_v_one") {
    return level.id.includes("heavy-touch") || level.id.includes("loose-touch") ? "one_v_one_loose_touch" : "one_v_one";
  }

  if (level.category === "defender_pressure") {
    return "defender_pressure";
  }

  const ball = toMeters(level.ball, pitch);
  const center = goalCenter(pitch);
  const lateral = Math.abs(ball.x - center.x);
  const distance = ball.y;

  if (distance <= 14) {
    return "close_shot";
  }

  if (distance >= 34) {
    return "long_shot";
  }

  if (lateral < pitch.goalWidth * 0.8) {
    return "central_shot";
  }

  if (lateral > pitch.goalWidth * 4.2) {
    return "sharp_angle";
  }

  return "side_shot";
}
