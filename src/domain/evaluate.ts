import type { CheckResult, ErrorType, EvaluationScore, Level, PitchConfig, Point, WallConfig, Zone } from "./types";
import {
  clamp,
  distance,
  distancePointToLine,
  facingAngleToBall,
  fromMeters,
  goalCenter,
  isInsideZone,
  leftPost,
  rightPost,
  toMeters
} from "./geometry";
import { buildPositionZones, classifyLocalPosition, isCorrect, isInsideShotAngle, toLocal } from "./positionZones";
import { getBallSide, inferScenarioType } from "./scenarios";

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

function isDangerousError(errorType?: ErrorType) {
  return errorType === "TOO_HIGH" || errorType === "NEAR_POST_OPEN" || errorType === "RUSHED_1V1" || errorType === "NO_BALL_VISIBILITY";
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
  const scenarioType = inferScenarioType(level, pitch);
  const positionZones = buildPositionZones(level, pitch);
  const localPosition = toLocal(goalkeeper, center, positionZones.axes);
  const insideShotAngle = isInsideShotAngle(goalkeeper, ball, pitch);
  const zoneClassification = classifyLocalPosition(localPosition, positionZones.cfg, insideShotAngle);
  const lineDistance = Math.abs(localPosition.v);
  const optimal = positionZones.ideal;
  const targetPercent = fromMeters(optimal, pitch);
  const targetPoint = toMeters(targetPercent, pitch);
  const depthDiff = Math.abs(localPosition.u - positionZones.cfg.idealDepth);
  const correctZone = level.correctZone ?? {
    xMin: positionZones.correct.center.x - positionZones.correct.sideHalf,
    xMax: positionZones.correct.center.x + positionZones.correct.sideHalf,
    yMin: positionZones.correct.center.y - positionZones.correct.depthHalf,
    yMax: positionZones.correct.center.y + positionZones.correct.depthHalf
  };
  let lineScore = scoreByDistance(lineDistance, positionZones.cfg.correctSideHalf, positionZones.cfg.sideSlack + 2.4);
  let depthScore = scoreByDistance(depthDiff, positionZones.cfg.correctDepthHalf, Math.max(positionZones.cfg.backSlack, positionZones.cfg.forwardSlack) + 3.2);
  const ballSide = getBallSide(ball, center);
  const side = ballSide === "center" ? 0 : ballSide === "left" ? -1 : 1;
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

  if (zoneClassification.errorType === "TOO_LEFT" || zoneClassification.errorType === "TOO_RIGHT") {
    mainErrorType = detectHorizontalError(goalkeeperPercent, targetPercent);
    lineScore = Math.min(lineScore, insideShotAngle ? lineScore : 54);
    nearPostScore = Math.min(nearPostScore, insideShotAngle ? nearPostScore : 52);
    notes.push("Смещение не совпадает с линией мяча.");
  } else if (lineScore < 55) {
    mainErrorType = Math.abs(goalkeeperPercent.x - 50) < 4 ? "TOO_CENTRAL" : detectHorizontalError(goalkeeperPercent, targetPercent);
    notes.push("Смещение не совпадает с линией мяча.");
  }

  if (zoneClassification.errorType === "TOO_HIGH") {
    depthScore = Math.min(depthScore, 42);
    mainErrorType = scenarioType === "one_v_one" || scenarioType === "one_v_one_loose_touch" ? "RUSHED_1V1" : "TOO_HIGH";
    notes.push("Позиция слишком высокая: ворота остаются за спиной.");
  } else if (zoneClassification.errorType === "TOO_DEEP") {
    depthScore = Math.min(depthScore, 48);
    mainErrorType = scenarioType === "one_v_one" || scenarioType === "one_v_one_loose_touch" ? "PASSIVE_1V1" : "TOO_DEEP";
    notes.push("Позиция слишком глубокая: нападающему видно больше ворот.");
  } else if (depthScore < 55) {
    mainErrorType = goalkeeper.y < targetPoint.y ? "TOO_DEEP" : "TOO_HIGH";
    notes.push(goalkeeper.y < targetPoint.y ? "Глубину нужно выбрать смелее." : "Глубину нужно выбрать спокойнее.");
  }

  if (nearPostScore < 55 && Math.abs(ball.x - center.x) > pitch.goalWidth * 0.8) {
    mainErrorType = "NEAR_POST_OPEN";
    notes.push("Ближний угол открыт.");
  }

  if (side !== 0 && distance(goalkeeper, nearPost) < Math.max(0.55, pitch.goalWidth * 0.18) && goalkeeper.y < Math.max(1.6, pitch.goalWidth * 0.65)) {
    nearPostScore = Math.min(nearPostScore, 68);
    mainErrorType = "OVERPROTECTS_NEAR_POST";
    notes.push("Слишком сильное смещение к ближней штанге открывает дальнюю часть ворот.");
  }

  if (scenarioType === "one_v_one" || scenarioType === "one_v_one_loose_touch") {
    if (localPosition.u < positionZones.cfg.idealDepth - positionZones.cfg.backSlack) {
      mainErrorType = "PASSIVE_1V1";
      notes.push("В 1-в-1 нужно сократить угол.");
    }

    if (localPosition.u > Math.min(ball.y - 1.5, positionZones.cfg.idealDepth + positionZones.cfg.forwardSlack)) {
      mainErrorType = "RUSHED_1V1";
      notes.push("Выход слишком далеко: нападающий может обыграть или перебросить.");
    }
  }

  if (scenarioType === "defender_pressure") {
    const defender = level.players.find((player) => player.role === "defender");

    if (defender) {
      const defenderPoint = toMeters(defender, pitch);
      const defenderNear = distance(defenderPoint, ball) < pitch.goalWidth * 1.15;

      if (defenderNear && localPosition.u > positionZones.cfg.idealDepth + positionZones.cfg.forwardSlack) {
        defenderScore = 45;
        mainErrorType = "IGNORED_DEFENDER";
        notes.push("Защитник рядом, ранний выход рискованный.");
      }
    }
  }

  if (level.previousBall) {
    const previousZones = buildPositionZones({ ...level, ball: level.previousBall }, pitch);
    const previousOptimal = previousZones.ideal;
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

  if (!isCorrect(localPosition, positionZones.cfg)) {
    mainErrorType = mainErrorType ?? detectPrecisionError(goalkeeperPercent, targetPercent);
    notes.push("Позиция вне основной правильной зоны.");
  }

  let total = Math.round(lineScore * 0.27 + depthScore * 0.27 + nearPostScore * 0.18 + orientationScore * 0.14 + defenderScore * 0.07 + passScore * 0.07);

  if (level.freeKick) {
    const selectedWall = wall ?? level.freeKick.initialWall;
    const countDiff = Math.abs(selectedWall.count - level.freeKick.recommendedWallCount);
    const targetWallCenter = zoneCenter(level.freeKick.wallZone);
    const selectedWallPoint = toMeters(selectedWall, pitch);
    const wallDistance = distance(toMeters(selectedWall, pitch), toMeters(targetWallCenter, pitch));
    const wallInZone = isInsideZone(selectedWall, level.freeKick.wallZone);
    const wallBetweenBallAndKeeper = selectedWallPoint.y > goalkeeper.y && selectedWallPoint.y < ball.y;
    const hiddenBehindWall = wallBetweenBallAndKeeper && distancePointToLine(goalkeeper, selectedWallPoint, ball) < Math.max(0.55, pitch.goalWidth * 0.14);

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

    if (hiddenBehindWall) {
      mainErrorType = "NO_BALL_VISIBILITY";
      wallPositionScore = Math.min(wallPositionScore, 72);
      notes.push("Вратарь спрятался за стенкой и плохо видит мяч.");
    }

    total = Math.round(total * 0.55 + wallCountScore * 0.2 + wallPositionScore * 0.25);
  }

  total = clamp(total, 0, 100);

  return {
    scenarioType,
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
    outsideShotAngle: !insideShotAngle,
    optimalPoint: targetPercent,
    correctZone,
    correctOrientedZone: positionZones.correct,
    almostOrientedZone: positionZones.almost,
    dangerOrientedZone:
      mainErrorType === "TOO_DEEP" || mainErrorType === "PASSIVE_1V1"
        ? positionZones.tooDeep
        : mainErrorType === "TOO_HIGH" || mainErrorType === "RUSHED_1V1"
          ? positionZones.tooHigh
          : undefined,
    tooDeepOrientedZone: positionZones.tooDeep,
    tooHighOrientedZone: positionZones.tooHigh,
    notes
  };
}

export function checkAnswer(goalkeeper: Point, level: Level, pitch: PitchConfig, goalkeeperFacing?: number, wall?: WallConfig): CheckResult {
  const evaluation = evaluateGoalkeeper(goalkeeper, level, pitch, goalkeeperFacing, wall);
  const positionZones = buildPositionZones(level, pitch);
  const localPosition = toLocal(toMeters(goalkeeper, pitch), goalCenter(pitch), positionZones.axes);
  const zoneClassification = classifyLocalPosition(localPosition, positionZones.cfg, !evaluation.outsideShotAngle);
  const inCorrectZone = zoneClassification.status === "correct";
  const wellOriented = evaluation.orientationScore >= 72;
  const wallReady = !level.freeKick || ((evaluation.wallCountScore ?? 100) >= 85 && (evaluation.wallPositionScore ?? 100) >= 80);
  const componentsReady = evaluation.lineScore >= 72 && evaluation.depthScore >= 72 && evaluation.nearPostScore >= 68 && wellOriented;
  const dangerous = zoneClassification.status === "dangerous" || (isDangerousError(evaluation.mainErrorType) && !componentsReady);

  if (inCorrectZone && componentsReady && evaluation.total >= 85 && wallReady && !dangerous) {
    return {
      result: "correct",
      score: Math.max(85, evaluation.total),
      text: level.successText,
      repeat: false,
      evaluation
    };
  }

  if (dangerous) {
    return {
      result: "dangerous",
      score: evaluation.total,
      text: level.errorText,
      repeat: true,
      errorType: zoneClassification.errorType ?? evaluation.mainErrorType ?? level.mainErrorType,
      evaluation
    };
  }

  if (!evaluation.outsideShotAngle && (zoneClassification.status === "almost" || evaluation.total >= 65 || inCorrectZone || (level.freeKick && wallReady))) {
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
