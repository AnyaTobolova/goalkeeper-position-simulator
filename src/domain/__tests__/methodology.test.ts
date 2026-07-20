import { describe, expect, it } from "vitest";
import type { Level, PitchConfig, WallConfig } from "../types";
import { levels } from "../levels";
import { pitchPresets } from "../presets";
import { buildPositionZones, getZoneConfig } from "../positionZones";
import { checkAnswer, evaluateGoalkeeper, freeKickWallZone, resolveTimeoutResult } from "../evaluate";
import { distancePointToLine, fromMeters, goalCenter, openGoalShare, rightPost, toMeters } from "../geometry";
import { centralBallThreshold, getBallSide } from "../scenarios";
import { applyLevelVariation, mirrorLevel, mirrorText } from "../variation";
import { keeperRank } from "../badges";

const pitch7 = pitchPresets["7v7"];

function levelById(id: string): Level {
  const found = levels.find((item) => item.id === id);

  if (!found) {
    throw new Error(`Уровень не найден: ${id}`);
  }

  return found;
}

function pitchForLevel(level: Level): PitchConfig {
  return level.pitchPresetOverride ? pitchPresets[level.pitchPresetOverride] : pitch7;
}

function idealPercent(level: Level, pitch: PitchConfig) {
  return fromMeters(buildPositionZones(level, pitch).ideal, pitch);
}

function recommendedWall(level: Level, pitch: PitchConfig): WallConfig | undefined {
  if (!level.freeKick) {
    return undefined;
  }

  const zone = freeKickWallZone(toMeters(level.ball, pitch), pitch);

  return {
    count: level.freeKick.recommendedWallCount,
    x: (zone.xMin + zone.xMax) / 2,
    y: (zone.yMin + zone.yMax) / 2
  };
}

describe("линия мяча и боковое смещение", () => {
  it("при мяче справа идеальная точка смещена вправо от центра", () => {
    const level = levelById("angle-right-half");
    const ideal = idealPercent(level, pitch7);

    expect(ideal.x).toBeGreaterThan(50);
  });

  it("вратарь на идеальной точке получает «Отлично»", () => {
    const level = levelById("angle-right-half");
    const result = checkAnswer(idealPercent(level, pitch7), level, pitch7);

    expect(result.result).toBe("correct");
  });
});

describe("корпус к мячу", () => {
  it("правильная точка ног без корпуса к мячу не дает «Отлично»", () => {
    const level = levelById("angle-right-half");
    const ideal = idealPercent(level, pitch7);
    const facingAway = 200; // корпус развернут в сторону от мяча
    const result = checkAnswer(ideal, level, pitch7, facingAway);

    expect(result.result).not.toBe("correct");
    expect(result.errorType).toBe("WRONG_BODY_ANGLE");
  });
});

describe("глубина зависит от размера ворот", () => {
  it("на маленьких воротах рабочая глубина ближе к линии", () => {
    const level = levelById("depth-long-center");
    const smallGoal: PitchConfig = { ...pitch7, goalWidth: 3 };
    const bigGoal: PitchConfig = { ...pitch7, goalWidth: 7.32 };

    expect(getZoneConfig(level, smallGoal).idealDepth).toBeLessThan(getZoneConfig(level, bigGoal).idealDepth);
  });

  it("порог «мяч по центру» зависит от ширины ворот", () => {
    const smallGoal: PitchConfig = { ...pitch7, goalWidth: 3 };
    const bigGoal: PitchConfig = { ...pitch7, goalWidth: 7.32 };
    const center = goalCenter(pitch7);
    const ball = { x: center.x + 4, y: 10 };

    expect(getBallSide(ball, center, centralBallThreshold(smallGoal))).toBe("right");
    expect(getBallSide(ball, center, centralBallThreshold(bigGoal))).toBe("center");
  });
});

describe("угловые: единая школа стойки", () => {
  it("при угловом справа целевая стойка между серединой ворот и дальней штангой", () => {
    const level = levelById("corner-right-near-post");
    const zones = buildPositionZones(level, pitch7);
    const center = goalCenter(pitch7);

    expect(zones.ideal.x).toBeLessThan(center.x);
    expect(zones.ideal.x).toBeGreaterThan(center.x - pitch7.goalWidth / 2);
    expect(zones.ideal.y).toBeCloseTo(0.9, 5);
  });

  it("глубина стойки при угловом не зависит от пресета поля", () => {
    const level = levelById("corner-right-open-far-post");

    expect(buildPositionZones(level, pitchPresets["7v7"]).ideal.y).toBeCloseTo(1, 5);
    expect(buildPositionZones(level, pitchPresets["11v11"]).ideal.y).toBeCloseTo(1, 5);
  });

  it("стойка у ближней штанги при угловом не считается правильной", () => {
    const level = levelById("corner-right-near-post");
    const nearPostPercent = fromMeters({ x: rightPost(pitch7).x, y: 0.5 }, pitch7);
    const result = checkAnswer(nearPostPercent, level, pitch7);

    expect(result.result).not.toBe("correct");
  });

  it("позиция на линии ворот при угловом - поправка, а не «Опасно»", () => {
    const level = levelById("corner-right-near-post");
    const zones = buildPositionZones(level, pitch7);
    const onLinePercent = fromMeters({ x: zones.ideal.x, y: 0 }, pitch7);
    const result = checkAnswer(onLinePercent, level, pitch7);

    expect(result.result).not.toBe("correct");
    expect(result.result).not.toBe("dangerous");
  });
});

describe("штрафные", () => {
  it("вратарь отвечает за открытую часть ворот, а не за сторону стенки", () => {
    const level = levelById("free-kick-right-edge");
    const zones = buildPositionZones(level, pitch7);
    const center = goalCenter(pitch7);

    // мяч справа, стенка закрывает правую (ближнюю) часть - вратарь левее центра
    expect(zones.ideal.x).toBeLessThan(center.x);
  });

  it("зона стенки лежит на линии мяч - ближняя штанга", () => {
    const level = levelById("free-kick-right-edge");
    const ball = toMeters(level.ball, pitch7);
    const zone = freeKickWallZone(ball, pitch7);
    const zoneCenter = toMeters({ x: (zone.xMin + zone.xMax) / 2, y: (zone.yMin + zone.yMax) / 2 }, pitch7);

    expect(distancePointToLine(zoneCenter, ball, rightPost(pitch7))).toBeLessThan(0.05);
  });

  it("правильная стенка и позиция дают «Отлично»", () => {
    const level = levelById("free-kick-right-edge");
    const result = checkAnswer(idealPercent(level, pitch7), level, pitch7, undefined, recommendedWall(level, pitch7));

    expect(result.result).toBe("correct");
  });
});

describe("пенальти: правило линии ворот", () => {
  it("вратарь на линии по центру получает «Отлично»", () => {
    const level = levelById("penalty-center");
    const onLine = fromMeters({ x: goalCenter(pitch7).x, y: 0.3 }, pitch7);
    const result = checkAnswer(onLine, level, pitch7);

    expect(result.result).toBe("correct");
  });

  it("выход с линии до удара - опасная ошибка", () => {
    const level = levelById("penalty-center");
    const offLine = fromMeters({ x: goalCenter(pitch7).x, y: 3 }, pitch7);
    const result = checkAnswer(offLine, level, pitch7);

    expect(result.result).toBe("dangerous");
    expect(result.errorType).toBe("TOO_HIGH");
  });
});

describe("реакция: игрок с мячом главный", () => {
  const reactionLevel: Level = {
    id: "test-reaction",
    title: "Тест",
    stage: "reaction_to_ball_owner",
    category: "reaction",
    scenarioType: "reaction_to_ball_owner",
    difficulty: 3,
    activatedBallOwnerId: "a1",
    ball: { x: 68, y: 24 },
    players: [
      { id: "a1", role: "attacker", x: 68, y: 24 },
      { id: "a2", role: "attacker", x: 28, y: 20 }
    ],
    initialGoalkeeper: { x: 50, y: 2 },
    mainErrorType: "WRONG_BALL_OWNER",
    successText: "",
    almostText: "",
    errorText: "",
    hintText: "",
    evaluationMode: "hybrid",
    explanationLayers: { showShotAngle: true, showBallLine: true, showNearPost: true, showSuggestedMove: true }
  };

  it("позиция от игрока без мяча распознается как WRONG_BALL_OWNER", () => {
    const decoyIdeal = idealPercent({ ...reactionLevel, ball: { x: 28, y: 20 } }, pitch7);
    const evaluation = evaluateGoalkeeper(decoyIdeal, reactionLevel, pitch7);

    expect(evaluation.mainErrorType).toBe("WRONG_BALL_OWNER");
  });

  it("позиция от активного мяча дает «Отлично»", () => {
    const result = checkAnswer(idealPercent(reactionLevel, pitch7), reactionLevel, pitch7);

    expect(result.result).toBe("correct");
  });

  it("таймаут не ухудшает результат, если позиция уже занята", () => {
    const ideal = idealPercent(reactionLevel, pitch7);
    const checked = checkAnswer(ideal, reactionLevel, pitch7);
    const resolved = resolveTimeoutResult(checked, ideal, reactionLevel.initialGoalkeeper);

    expect(resolved.result).toBe("correct");
    expect(resolved.errorType).not.toBe("TOO_LATE_REACTION");
  });

  it("таймаут без реакции - «Опасно» с TOO_LATE_REACTION", () => {
    const start = reactionLevel.initialGoalkeeper;
    const checked = checkAnswer(start, reactionLevel, pitch7);
    const resolved = resolveTimeoutResult(checked, start, start);

    expect(resolved.result).toBe("dangerous");
    expect(resolved.errorType).toBe("TOO_LATE_REACTION");
  });

  it("таймаут с занятой, но неточной позицией сохраняет позиционную ошибку", () => {
    const wrongSpot = { x: 30, y: 12 };
    const checked = checkAnswer(wrongSpot, reactionLevel, pitch7);
    const resolved = resolveTimeoutResult(checked, wrongSpot, reactionLevel.initialGoalkeeper);

    expect(resolved.errorType).not.toBe("TOO_LATE_REACTION");
    expect(resolved.evaluation.notes).toContain("Время на реакцию закончилось.");
  });
});

describe("открытая часть ворот", () => {
  it("правильная глубина закрывает больше ворот, чем позиция на линии", () => {
    const level = levelById("depth-long-center");
    const ball = toMeters(level.ball, pitch7);
    const ideal = buildPositionZones(level, pitch7).ideal;
    const onLine = { x: goalCenter(pitch7).x, y: 0.3 };

    expect(openGoalShare(ball, ideal, pitch7)).toBeLessThan(openGoalShare(ball, onLine, pitch7));
  });
});

describe("вариации координат при повторах", () => {
  const level = levelById("angle-right-half");

  it("первая попытка не меняет уровень", () => {
    expect(applyLevelVariation(level, 0)).toBe(level);
  });

  it("повтор сдвигает мяч, сохраняя сторону, и детерминирован", () => {
    const varied = applyLevelVariation(level, 2);

    expect(varied.ball).not.toEqual(level.ball);
    expect(varied.ball.x).toBeGreaterThan(52);
    expect(applyLevelVariation(level, 2).ball).toEqual(varied.ball);
  });

  it("идеальная точка вариации тоже дает «Отлично»", () => {
    const varied = applyLevelVariation(level, 3);
    const result = checkAnswer(idealPercent(varied, pitch7), varied, pitch7);

    expect(result.result).toBe("correct");
  });
});

describe("зеркальные вариации", () => {
  it("mirrorText меняет стороны и не трогает похожие слова", () => {
    expect(mirrorText("Мяч справа, закрой правый угол")).toBe("Мяч слева, закрой левый угол");
    expect(mirrorText("Мяч слева - сместись левее")).toBe("Мяч справа - сместись правее");
    expect(mirrorText("Ты правильно выбрал позицию по правилам")).toBe("Ты правильно выбрал позицию по правилам");
  });

  it("зеркальный уровень корректен: координаты и цель отражены, идеал дает «Отлично»", () => {
    const level = levelById("angle-right-half");
    const mirrored = mirrorLevel(level);

    expect(mirrored.ball.x).toBeCloseTo(100 - level.ball.x, 5);
    expect(checkAnswer(idealPercent(mirrored, pitch7), mirrored, pitch7).result).toBe("correct");
  });

  it("зеркальный штрафной отражает цель у ворот и стенку", () => {
    const level = levelById("free-kick-right-edge");
    const mirrored = mirrorLevel(level);

    expect(mirrored.goalTarget?.side).toBeCloseTo(-(level.goalTarget?.side ?? 0), 5);
    expect(checkAnswer(idealPercent(mirrored, pitch7), mirrored, pitch7, undefined, recommendedWall(mirrored, pitch7)).result).toBe("correct");
  });
});

describe("звания вратаря", () => {
  it("растут с числом закрепленных сценариев", () => {
    expect(keeperRank(0)).toBe("Новичок");
    expect(keeperRank(12)).toBe("Уверенный");
    expect(keeperRank(30)).toBe("Хозяин штрафной");
    expect(keeperRank(50)).toBe("Стена");
  });
});

describe("решение на подаче", () => {
  it("уровни с чистой подачей требуют выхода, с толпой - контроля ворот", () => {
    expect(levelById("high-cross-clean-right").exitDecision).toBe("go");
    expect(levelById("high-cross-crowd").exitDecision).toBe("stay");
  });

  it("идеальная точка уровня с выходом заметно выше, чем у навеса в толпу", () => {
    const goIdeal = buildPositionZones(levelById("high-cross-clean-right"), pitch7).ideal;
    const stayIdeal = buildPositionZones(levelById("high-cross-crowd"), pitch7).ideal;

    expect(goIdeal.y).toBeGreaterThan(stayIdeal.y);
  });
});

describe("методический инвариант: идеальная точка каждого уровня дает «Отлично»", () => {
  for (const level of levels) {
    it(level.id, () => {
      const pitch = pitchForLevel(level);
      const result = checkAnswer(idealPercent(level, pitch), level, pitch, undefined, recommendedWall(level, pitch));

      expect(result.result).toBe("correct");
    });
  }
});
