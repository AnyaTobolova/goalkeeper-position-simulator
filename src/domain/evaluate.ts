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
  openGoalShare,
  rightPost,
  toMeters,
  widestOpenGoalPoint
} from "./geometry";
import { buildPositionZones, classifyLocalPosition, isCorrect, isInsideShotAngle, toLocal } from "./positionZones";
import { centralBallThreshold, getBallSide, goalAnchoredScenarios, inferScenarioType } from "./scenarios";

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

// Правильная стенка стоит на линии мяч - ближняя штанга на разрешенном
// правилами расстоянии от мяча (радиус дуги штрафной = 9,15 м у взрослых,
// меньше в детских форматах). Зона считается от геометрии, а не задается
// вручную, поэтому не зависит от выбранного пресета поля.
export function freeKickWallZone(ballMeters: Point, pitch: PitchConfig): Zone {
  const center = goalCenter(pitch);
  const nearPostPoint = ballMeters.x >= center.x ? rightPost(pitch) : leftPost(pitch);
  const toPost = { x: nearPostPoint.x - ballMeters.x, y: nearPostPoint.y - ballMeters.y };
  const len = Math.max(0.1, Math.hypot(toPost.x, toPost.y));
  const legalDistance = pitch.markings.penaltyArcRadius ?? 9.15;
  const wallDistance = Math.min(legalDistance, len * 0.7);
  const wallCenter = {
    x: ballMeters.x + (toPost.x / len) * wallDistance,
    y: ballMeters.y + (toPost.y / len) * wallDistance
  };
  const centerPercent = fromMeters(wallCenter, pitch);
  const xHalf = (1.4 / pitch.fieldWidth) * 100;
  const yHalf = (1.6 / pitch.fieldLength) * 100;

  return {
    xMin: centerPercent.x - xHalf,
    xMax: centerPercent.x + xHalf,
    yMin: Math.max(0, centerPercent.y - yHalf),
    yMax: centerPercent.y + yHalf
  };
}

function isDangerousError(errorType?: ErrorType) {
  return errorType === "TOO_HIGH" || errorType === "NEAR_POST_OPEN" || errorType === "RUSHED_1V1" || errorType === "NO_BALL_VISIBILITY";
}

function isDepthPositionError(errorType?: ErrorType) {
  return errorType === "TOO_HIGH" || errorType === "TOO_DEEP" || errorType === "RUSHED_1V1" || errorType === "PASSIVE_1V1";
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
  const setPiece = goalAnchoredScenarios.has(scenarioType);
  const positionZones = buildPositionZones(level, pitch);
  const localPosition = toLocal(goalkeeper, positionZones.center, positionZones.axes);
  // При угловом и высоком навесе удара еще нет: стартовая стойка у ворот
  // не обязана попадать в сектор мяч-штанги.
  const insideShotAngle = scenarioType === "corner" || scenarioType === "high_cross" ? true : isInsideShotAngle(goalkeeper, ball, pitch);
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
  const ballSide = getBallSide(ball, center, centralBallThreshold(pitch));
  const side = ballSide === "center" ? 0 : ballSide === "left" ? -1 : 1;
  const nearPost = side < 0 ? leftPost(pitch) : rightPost(pitch);
  const nearPostDistance = distancePointToLine(goalkeeper, nearPost, ball);
  // Для стандартов ближний угол закрывается стенкой или задан целевой зоной,
  // поэтому отдельная оценка ближней штанги не применяется.
  let nearPostScore = side === 0 || setPiece ? 100 : scoreByDistance(nearPostDistance, pitch.goalWidth * 0.38, pitch.goalWidth * 1.15);
  const targetFacing = facingAngleToBall(goalkeeperPercent, level.ball);
  const orientationScore = scoreByDistance(angleDifference(goalkeeperFacing, targetFacing), 14, 78);
  let defenderScore = 100;
  let passScore = 100;
  let wallCountScore: number | undefined;
  let wallPositionScore: number | undefined;
  let resolvedWallZone: Zone | undefined;
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

  if (!setPiece && nearPostScore < 55 && Math.abs(ball.x - center.x) > pitch.goalWidth * 0.8) {
    mainErrorType = "NEAR_POST_OPEN";
    notes.push("Ближний угол открыт.");
  }

  if (!setPiece && side !== 0 && distance(goalkeeper, nearPost) < Math.max(0.55, pitch.goalWidth * 0.18) && goalkeeper.y < Math.max(1.6, pitch.goalWidth * 0.65)) {
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

  if (scenarioType === "reaction_to_ball_owner" && level.activatedBallOwnerId) {
    const acceptableZone = zoneClassification.status === "correct" || zoneClassification.status === "almost";
    const decoys = level.players.filter((player) => player.role === "attacker" && player.id !== level.activatedBallOwnerId);

    if (!acceptableZone) {
      for (const decoy of decoys) {
        const decoyZones = buildPositionZones({ ...level, ball: { x: decoy.x, y: decoy.y } }, pitch);

        if (distance(goalkeeper, decoyZones.ideal) + 1 < distance(goalkeeper, optimal)) {
          passScore = Math.min(passScore, 40);
          mainErrorType = "WRONG_BALL_OWNER";
          notes.push("Позиция построена от игрока без мяча, а не от активного мяча.");
          break;
        }
      }
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
    const targetWallZone = freeKickWallZone(ball, pitch);
    resolvedWallZone = targetWallZone;
    const targetWallCenter = zoneCenter(targetWallZone);
    const selectedWallPoint = toMeters(selectedWall, pitch);
    const wallDistance = distance(toMeters(selectedWall, pitch), toMeters(targetWallCenter, pitch));
    const wallInZone = isInsideZone(selectedWall, targetWallZone);
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

  // Стандарты без прямого удара (угловой, навес) и штрафной со стенкой
  // не показывают процент: там открытость определяется не только вратарем.
  const showsOpenGoal = !setPiece || scenarioType === "penalty";
  const openGoalPercent = showsOpenGoal ? Math.round(openGoalShare(ball, goalkeeper, pitch) * 100) : undefined;
  const optimalOpenGoalPercent = showsOpenGoal ? Math.round(openGoalShare(ball, targetPoint, pitch) * 100) : undefined;
  const openShotTarget = showsOpenGoal ? fromMeters(widestOpenGoalPoint(ball, goalkeeper, pitch), pitch) : undefined;

  return {
    scenarioType,
    openGoalPercent,
    optimalOpenGoalPercent,
    openShotTarget,
    lineScore,
    depthScore,
    nearPostScore,
    defenderScore,
    passScore,
    orientationScore,
    wallCountScore,
    wallPositionScore,
    wallZone: resolvedWallZone,
    total,
    mainErrorType,
    outsideShotAngle: !insideShotAngle,
    goalkeeperPoint: goalkeeperPercent,
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

// По окончании времени реакции оценивается фактическая позиция: если вратарь
// успел занять рабочую точку, результат не ухудшается. TOO_LATE_REACTION
// ставится только когда вратарь фактически не отреагировал и остался у старта.
export function resolveTimeoutResult(checked: CheckResult, goalkeeper: Point, startPoint: Point): CheckResult {
  if (checked.result === "correct" || checked.result === "almost") {
    return checked;
  }

  const movedDistance = Math.hypot(goalkeeper.x - startPoint.x, goalkeeper.y - startPoint.y);

  if (movedDistance < 3) {
    return {
      ...checked,
      result: "dangerous",
      score: Math.min(checked.score, 35),
      text: "Время вышло: нужно быстрее найти игрока с мячом и занять позицию.",
      repeat: true,
      errorType: "TOO_LATE_REACTION",
      evaluation: {
        ...checked.evaluation,
        mainErrorType: "TOO_LATE_REACTION",
        notes: [...checked.evaluation.notes, "Время на реакцию закончилось."]
      }
    };
  }

  return {
    ...checked,
    evaluation: {
      ...checked.evaluation,
      notes: [...checked.evaluation.notes, "Время на реакцию закончилось."]
    }
  };
}

export function checkAnswer(goalkeeper: Point, level: Level, pitch: PitchConfig, goalkeeperFacing?: number, wall?: WallConfig): CheckResult {
  const evaluation = evaluateGoalkeeper(goalkeeper, level, pitch, goalkeeperFacing, wall);
  const positionZones = buildPositionZones(level, pitch);
  const localPosition = toLocal(toMeters(goalkeeper, pitch), positionZones.center, positionZones.axes);
  const zoneClassification = classifyLocalPosition(localPosition, positionZones.cfg, !evaluation.outsideShotAngle);
  const inCorrectZone = zoneClassification.status === "correct";
  const wellOriented = evaluation.orientationScore >= 72;
  const wallReady = !level.freeKick || ((evaluation.wallCountScore ?? 100) >= 85 && (evaluation.wallPositionScore ?? 100) >= 80);
  const componentsReady = evaluation.lineScore >= 72 && evaluation.depthScore >= 72 && evaluation.nearPostScore >= 68 && wellOriented;
  const acceptableZone = inCorrectZone || zoneClassification.status === "almost";
  const dangerous =
    !acceptableZone &&
    (zoneClassification.status === "dangerous" || (!isDepthPositionError(evaluation.mainErrorType) && isDangerousError(evaluation.mainErrorType) && !componentsReady));

  if (inCorrectZone && wallReady && !dangerous) {
    // Правильная точка ног без корпуса к мячу не дает «Отлично»:
    // вратарь должен быть готов реагировать на удар.
    if (!wellOriented) {
      return {
        result: "almost",
        score: Math.min(evaluation.total, 78),
        text: "Точка ног выбрана верно, но корпус должен быть развернут к мячу.",
        repeat: true,
        errorType: "WRONG_BODY_ANGLE",
        evaluation: { ...evaluation, mainErrorType: "WRONG_BODY_ANGLE" }
      };
    }

    // «Отлично» требует, чтобы и линия, и глубина, и угол были хорошими,
    // а не только формального попадания в зону.
    if (!componentsReady) {
      return {
        result: "almost",
        score: Math.min(evaluation.total, 80),
        text: level.almostText,
        repeat: true,
        errorType: evaluation.mainErrorType ?? "ALMOST",
        evaluation
      };
    }

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

  if (!evaluation.outsideShotAngle && (zoneClassification.status === "almost" || inCorrectZone || (level.freeKick && wallReady && zoneClassification.status !== "needs_fix"))) {
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
