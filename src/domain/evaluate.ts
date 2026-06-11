import type { CheckResult, ErrorType, EvaluationScore, Level, PitchConfig, Point, WallConfig, Zone } from "./types";
import {
  distance,
  distancePointToLine,
  facingAngleToBall,
  fromMeters,
  goalCenter,
  isInsideZone,
  leftPost,
  optimalDepth,
  pointOnBallLine,
  rightPost,
  toMeters,
  zoneAround
} from "./geometry";

function scoreByDistance(value: number, good: number, bad: number) {
  if (value <= good) {
    return 100;
  }

  if (value >= bad) {
    return 0;
  }

  return Math.round(100 - ((value - good) / (bad - good)) * 100);
}

function detectHorizontalError(goalkeeper: Point, optimal: Point): ErrorType {
  if (goalkeeper.x < optimal.x) {
    return "TOO_LEFT";
  }

  return "TOO_RIGHT";
}

function detectPrecisionError(goalkeeper: Point, optimal: Point): ErrorType {
  const dx = optimal.x - goalkeeper.x;
  const dy = optimal.y - goalkeeper.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "TOO_LEFT" : "TOO_RIGHT";
  }

  return dy > 0 ? "TOO_DEEP" : "TOO_HIGH";
}

function normalizeAngleValue(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function angleDifference(a: number, b: number) {
  const diff = Math.abs(normalizeAngleValue(a) - normalizeAngleValue(b));
  return Math.min(diff, 360 - diff);
}

function zoneCenter(zone: Zone): Point {
  return {
    x: (zone.xMin + zone.xMax) / 2,
    y: (zone.yMin + zone.yMax) / 2
  };
}

export function evaluateGoalkeeper(
  goalkeeperPercent: Point,
  level: Level,
  pitch: PitchConfig,
  goalkeeperFacing = facingAngleToBall(goalkeeperPercent, level.ball),
  wall?: WallConfig
): EvaluationScore {
  const ball = toMeters(level.ball, pitch);
  const goalkeeper = toMeters(goalkeeperPercent, pitch);
  const center = goalCenter(pitch);
  const lineDistance = distancePointToLine(goalkeeper, center, ball);
  const levelKind = level.category === "one_v_one" ? "one_v_one" : level.category === "defender_pressure" ? "defender" : "normal";
  const depth = optimalDepth(ball, pitch, levelKind);
  const optimal = pointOnBallLine(ball, pitch, depth);
  const optimalPercent = fromMeters(optimal, pitch);
  const correctZone = level.correctZone ?? zoneAround(optimal, pitch, Math.max(0.45, pitch.goalWidth * 0.1), Math.max(0.45, pitch.goalWidth * 0.1));
  const targetPercent = level.correctZone ? zoneCenter(correctZone) : optimalPercent;
  const targetPoint = toMeters(targetPercent, pitch);
  const depthDiff = Math.abs(goalkeeper.y - optimal.y);
  let lineScore = scoreByDistance(lineDistance, Math.max(0.85, pitch.goalWidth * 0.13), Math.max(4, pitch.goalWidth * 0.75));
  let depthScore = scoreByDistance(depthDiff, Math.max(1.1, pitch.goalWidth * 0.18), Math.max(5, pitch.goalWidth * 0.95));
  const side = Math.sign(ball.x - center.x);
  const nearPost = side < 0 ? leftPost(pitch) : rightPost(pitch);
  const nearPostDistance = distancePointToLine(goalkeeper, nearPost, ball);
  let nearPostScore = side === 0 ? 100 : scoreByDistance(nearPostDistance, pitch.goalWidth * 0.38, pitch.goalWidth * 1.15);
  const targetFacing = facingAngleToBall(goalkeeperPercent, level.ball);
  const orientationScore = scoreByDistance(angleDifference(goalkeeperFacing, targetFacing), 14, 78);
  let defenderScore = 100;
  let passScore = 100;
  let wallCountScore: number | undefined;
  let wallPositionScore: number | undefined;
  const notes: string[] = [];
  let mainErrorType: ErrorType | undefined;

  if (level.correctZone && level.evaluationMode === "zone") {
    const targetDistance = distance(goalkeeper, targetPoint);
    lineScore = scoreByDistance(Math.abs(goalkeeper.x - targetPoint.x), Math.max(0.45, pitch.goalWidth * 0.08), Math.max(3, pitch.goalWidth * 0.55));
    depthScore = scoreByDistance(Math.abs(goalkeeper.y - targetPoint.y), Math.max(0.45, pitch.goalWidth * 0.08), Math.max(3, pitch.goalWidth * 0.55));
    nearPostScore = scoreByDistance(targetDistance, Math.max(0.75, pitch.goalWidth * 0.14), Math.max(4, pitch.goalWidth * 0.8));
  }

  if (lineScore < 55) {
    mainErrorType = Math.abs(goalkeeperPercent.x - 50) < 4 ? "TOO_CENTRAL" : detectHorizontalError(goalkeeperPercent, targetPercent);
    notes.push("Смещение не совпадает с линией мяча.");
  }

  if (depthScore < 55) {
    mainErrorType = goalkeeper.y < targetPoint.y ? "TOO_DEEP" : "TOO_HIGH";
    notes.push(goalkeeper.y < targetPoint.y ? "Позиция слишком глубокая." : "Позиция слишком высокая.");
  }

  if (nearPostScore < 55 && Math.abs(ball.x - center.x) > pitch.goalWidth * 0.8) {
    mainErrorType = "NEAR_POST_OPEN";
    notes.push("Ближний угол открыт.");
  }

  if (level.category === "one_v_one") {
    if (goalkeeper.y < optimal.y * 0.55) {
      mainErrorType = "PASSIVE_1V1";
      notes.push("В 1-в-1 нужно сократить угол.");
    }

    if (goalkeeper.y > ball.y - 1.5) {
      mainErrorType = "RUSHED_1V1";
      notes.push("Выход слишком далеко, нападающий может обыграть.");
    }
  }

  if (level.category === "defender_pressure") {
    const defender = level.players.find((player) => player.role === "defender");

    if (defender) {
      const defenderPoint = toMeters(defender, pitch);
      const defenderNear = distance(defenderPoint, ball) < pitch.goalWidth * 1.15;

      if (defenderNear && goalkeeper.y > optimal.y + pitch.goalWidth * 0.35) {
        defenderScore = 45;
        mainErrorType = "IGNORED_DEFENDER";
        notes.push("Защитник рядом, ранний выход рискованный.");
      }
    }
  }

  if (level.previousBall) {
    const previousBall = toMeters(level.previousBall, pitch);
    const previousOptimal = pointOnBallLine(previousBall, pitch, optimalDepth(previousBall, pitch, "normal"));
    const closerToOldLine = distance(goalkeeper, previousOptimal) + 1 < distance(goalkeeper, optimal);

    if (closerToOldLine) {
      passScore = 45;
      mainErrorType = "NOT_ADJUSTED_AFTER_PASS";
      notes.push("Позиция осталась от старого положения мяча.");
    }
  }

  if (orientationScore < 55) {
    if (!mainErrorType || (lineScore >= 70 && depthScore >= 70 && nearPostScore >= 70)) {
      mainErrorType = "WRONG_BODY_ANGLE";
    }

    notes.push("Корпус развернут не к мячу.");
  }

  if (!isInsideZone(goalkeeperPercent, correctZone)) {
    mainErrorType = mainErrorType ?? detectPrecisionError(goalkeeperPercent, targetPercent);
    notes.push("Белая точка стоп вне зеленой зоны.");
  }

  let total = Math.round(lineScore * 0.27 + depthScore * 0.27 + nearPostScore * 0.18 + orientationScore * 0.14 + defenderScore * 0.07 + passScore * 0.07);

  if (level.freeKick) {
    const selectedWall = wall ?? level.freeKick.initialWall;
    const countDiff = Math.abs(selectedWall.count - level.freeKick.recommendedWallCount);
    const targetWallCenter = zoneCenter(level.freeKick.wallZone);
    const wallDistance = distance(toMeters(selectedWall, pitch), toMeters(targetWallCenter, pitch));
    const wallInZone = isInsideZone(selectedWall, level.freeKick.wallZone);

    wallCountScore = countDiff === 0 ? 100 : countDiff === 1 ? 62 : countDiff === 2 ? 28 : 0;
    wallPositionScore = wallInZone ? 100 : scoreByDistance(wallDistance, Math.max(0.65, pitch.goalWidth * 0.12), Math.max(4, pitch.goalWidth * 0.8));

    if (wallCountScore < 85) {
      mainErrorType = "WALL_COUNT_WRONG";
      notes.push(`В стенке нужно ${level.freeKick.recommendedWallCount}, сейчас ${selectedWall.count}.`);
    }

    if (wallPositionScore < 80) {
      mainErrorType = mainErrorType ?? "WALL_POSITION_WRONG";
      notes.push("Стенка не закрывает ближний угол.");
    }

    total = Math.round(total * 0.55 + wallCountScore * 0.2 + wallPositionScore * 0.25);
  }

  return {
    lineScore,
    depthScore,
    nearPostScore,
    defenderScore,
    passScore,
    orientationScore,
    wallCountScore,
    wallPositionScore,
    wallZone: level.freeKick?.wallZone,
    total,
    mainErrorType,
    optimalPoint: targetPercent,
    correctZone,
    notes
  };
}

export function checkAnswer(goalkeeper: Point, level: Level, pitch: PitchConfig, goalkeeperFacing?: number, wall?: WallConfig): CheckResult {
  const evaluation = evaluateGoalkeeper(goalkeeper, level, pitch, goalkeeperFacing, wall);
  const inCorrectZone = isInsideZone(goalkeeper, evaluation.correctZone);
  const wellOriented = evaluation.orientationScore >= 80;
  const wallReady = !level.freeKick || ((evaluation.wallCountScore ?? 100) >= 85 && (evaluation.wallPositionScore ?? 100) >= 80);

  if (inCorrectZone && wellOriented && wallReady) {
    return {
      result: "correct",
      score: Math.max(85, evaluation.total),
      text: level.successText,
      repeat: false,
      evaluation
    };
  }

  if ((level.almostZone && isInsideZone(goalkeeper, level.almostZone)) || evaluation.total >= 65 || inCorrectZone || (level.freeKick && wallReady)) {
    return {
      result: "almost",
      score: evaluation.total,
      text: level.almostText,
      repeat: true,
      errorType: evaluation.mainErrorType,
      evaluation
    };
  }

  return {
    result: "wrong",
    score: evaluation.total,
    text: level.errorText,
    repeat: true,
    errorType: evaluation.mainErrorType ?? level.mainErrorType,
    evaluation
  };
}
