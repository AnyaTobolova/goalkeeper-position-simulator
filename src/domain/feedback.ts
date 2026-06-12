import type { CheckResult, ErrorType, Level, ScenarioType, VisualHint } from "./types";
import { criteriaByScenarioType, getBallSide, type CriterionKey } from "./scenarios";

export type FeedbackStatus = "excellent" | "almost" | "wrong" | "dangerous";
export type CriterionStatus = "good" | "almost" | "bad" | "dangerous";

export type Criterion = {
  key: CriterionKey;
  label: string;
  status: CriterionStatus;
  text: string;
};

export type FeedbackResult = {
  status: FeedbackStatus;
  title: string;
  summary: string;
  criteria: Criterion[];
  mainAdvice: string;
  details?: {
    why: string;
    howToFix: string;
  };
  visualHints: VisualHint[];
};

type FeedbackErrorType = ErrorType | "WRONG_POSITION" | "ALMOST";

const lineCriterionTexts: Record<CriterionStatus, string> = {
  good: "смещение верное",
  almost: "нужно чуть точнее к линии мяча",
  bad: "ты ушёл с линии мяча",
  dangerous: "линия удара открыта"
};

const readinessCriterionTexts: Record<CriterionStatus, string> = {
  good: "можешь реагировать",
  almost: "нужно быть устойчивее",
  bad: "реагировать сложно",
  dangerous: "сложно успеть на удар"
};

const adjustmentCriterionTexts: Record<CriterionStatus, string> = {
  good: "учтена новая точка мяча",
  almost: "нужно быстрее перестроиться",
  bad: "ты остался в старой позиции",
  dangerous: "новая линия удара открыта"
};

const farPostCriterionTexts: Record<CriterionStatus, string> = {
  good: "дальний угол под контролем",
  almost: "дальний угол почти под контролем",
  bad: "дальний угол открыт",
  dangerous: "дальний угол открыт"
};

const visibilityCriterionTexts: Record<CriterionStatus, string> = {
  good: "мяч видно",
  almost: "обзор неидеальный",
  bad: "мяч плохо видно",
  dangerous: "ты не видишь мяч"
};

const wallCriterionTexts: Record<CriterionStatus, string> = {
  good: "стенка и вратарь делят ворота",
  almost: "нужно чуть лучше видеть мяч",
  bad: "стенка стоит неточно",
  dangerous: "ты спрятался за стенкой"
};

const excellentSummaryByScenarioType: Record<ScenarioType, string> = {
  central_shot: "Ты правильно выбрал игровую зону и закрыл угол удара.",
  side_shot: "Ты правильно сместился к мячу и закрыл ближний угол.",
  sharp_angle: "Ты закрыл ближний угол и не открыл ворота за спиной.",
  long_shot: "Ты выбрал безопасную глубину и готов к дальнему удару.",
  close_shot: "Ты не выбежал лишнего и готов реагировать на удар.",
  one_v_one: "Ты сократил угол и сохранил готовность к удару.",
  one_v_one_loose_touch: "Ты смело вышел к мячу и сохранил контроль.",
  pass_or_cutback: "Ты перестроился за мячом и занял новую линию удара.",
  cross_goal: "Ты двигаешься за мячом и контролируешь ворота.",
  high_cross: "Ты видишь мяч, контролируешь траекторию и не бросаешь ворота.",
  corner: "Ты выбрал стартовую позицию, из которой видишь мяч и ворота.",
  free_kick: "Ты видишь мяч и занял открытую часть ворот за стенкой.",
  defender_pressure: "Ты учёл защитника и сохранил правильную позицию.",
  sweeper_position: "Ты стоишь выше и готов помочь команде, не теряя ворота."
};

const summaryByErrorType: Record<FeedbackErrorType, string> = {
  TOO_HIGH: "Ты правильно сместился к мячу, но вышел слишком далеко. Ворота остались за спиной, и нападающий может перебросить.",
  TOO_DEEP: "Ты правильно сместился к мячу, но стоишь слишком близко к линии ворот. Из-за этого нападающему видно больше ворот.",
  TOO_LEFT: "Ты ушёл слишком влево от линии мяча. Часть ворот открыта.",
  TOO_RIGHT: "Ты ушёл слишком вправо от линии мяча. Часть ворот открыта.",
  TOO_CENTRAL: "Мяч сбоку, а ты стоишь слишком по центру. Ближний угол открыт.",
  NEAR_POST_OPEN: "Ближний угол открыт. С этой позиции туда легко пробить.",
  OVERPROTECTS_NEAR_POST: "Ты слишком прижался к ближней штанге. Дальняя часть ворот открыта.",
  NOT_ADJUSTED_AFTER_PASS: "Мяч уже в другой точке. Позицию нужно поменять.",
  STUCK_NEAR_POST: "Мяч уже в другой точке. Позицию нужно поменять.",
  RUSHED_1V1: "Ты слишком резко выбежал. Нужно остановиться перед ударом.",
  PASSIVE_1V1: "Ты остался слишком близко к линии ворот. В 1-в-1 нужно выйти навстречу.",
  NO_BALL_VISIBILITY: "Ты не видишь мяч из-за игроков или стенки. Так сложно среагировать.",
  WALL_COUNT_WRONG: "Для этого штрафного нужно другое число игроков в стенке.",
  WALL_POSITION_WRONG: "Стенка стоит не на той линии и не закрывает нужную часть ворот.",
  WRONG_BODY_ANGLE: "Позиция ног почти подходит, но корпус нужно повернуть к мячу.",
  IGNORED_DEFENDER: "Защитник уже мешает игроку с мячом, поэтому выходить так далеко рискованно.",
  WRONG_POSITION: "Позиция выбрана неудачно. Нужно вернуться к линии мяча и защитить ворота.",
  ALMOST: "Ты выбрал почти правильную зону. Осталось чуть точнее выбрать позицию."
};

const adviceByErrorType: Record<FeedbackErrorType, string> = {
  TOO_HIGH: "Сделай маленький шаг назад к воротам.",
  TOO_DEEP: "Выйди на маленький шаг вперёд и останься на линии мяча.",
  TOO_LEFT: "Сместись чуть правее, ближе к линии мяча.",
  TOO_RIGHT: "Сместись чуть левее, ближе к линии мяча.",
  TOO_CENTRAL: "Сместись к стороне мяча.",
  NEAR_POST_OPEN: "Закрой ближний угол рядом с мячом.",
  OVERPROTECTS_NEAR_POST: "Отойди чуть от штанги к центру ворот.",
  NOT_ADJUSTED_AFTER_PASS: "Двигайся за мячом в новую позицию.",
  STUCK_NEAR_POST: "Двигайся за мячом в новую позицию.",
  RUSHED_1V1: "Остановись перед ударом, чтобы успеть среагировать.",
  PASSIVE_1V1: "Выйди навстречу мячу.",
  NO_BALL_VISIBILITY: "Стань так, чтобы видеть мяч.",
  WALL_COUNT_WRONG: "Подбери число игроков в стенке под опасность удара.",
  WALL_POSITION_WRONG: "Поставь стенку на линию удара к ближней штанге.",
  WRONG_BODY_ANGLE: "Оставь позицию ног и поверни корпус к мячу.",
  IGNORED_DEFENDER: "Учти помощь защитника и не выбегай без причины.",
  ALMOST: "Сделай маленькую поправку и останься в игровой зоне.",
  WRONG_POSITION: "Найди мяч, центр ворот и вернись на линию удара."
};

const reinforceByScenarioType: Record<ScenarioType, string> = {
  central_shot: "Запомни правило: встань на линию мяча, выбери безопасную глубину и будь готов к удару.",
  side_shot: "Запомни правило: мяч сбоку - сместись к мячу и закрой ближний угол.",
  sharp_angle: "Запомни правило: при остром угле сначала держи ближний угол и не выбегай слишком далеко.",
  long_shot: "Запомни правило: при дальнем ударе можно стоять выше, но только до безопасной границы.",
  close_shot: "Запомни правило: при близком ударе не выбегай лишнего, главное - успеть среагировать.",
  one_v_one: "Запомни правило: выйди навстречу, сократи угол и остановись перед ударом.",
  one_v_one_loose_touch: "Запомни правило: если мяч отпущен далеко, выйди смелее, но остановись перед ударом.",
  pass_or_cutback: "Запомни правило: мяч поменял точку - позиция вратаря тоже меняется.",
  cross_goal: "Запомни правило: двигайся за мячом и не залипай у старой штанги.",
  high_cross: "Запомни правило: сначала прочитай траекторию, потом решай - выходить или держать ворота.",
  corner: "Запомни правило: при угловом важно видеть мяч, игроков и не провалиться в ворота.",
  free_kick: "Запомни правило: стенка закрывает одну часть, ты отвечаешь за открытую и должен видеть мяч.",
  defender_pressure: "Запомни правило: если защитник помогает, держи позицию и не выбегай без причины.",
  sweeper_position: "Запомни правило: когда мяч далеко, можно стоять выше, но не терять ворота за спиной."
};

export function criterionStatusText(status: CriterionStatus) {
  switch (status) {
    case "good":
      return "хорошо";
    case "almost":
    case "bad":
      return "поправить";
    case "dangerous":
      return "опасно";
  }
}

function resultStatus(result: CheckResult): FeedbackStatus {
  if (result.result === "correct") {
    return "excellent";
  }

  return result.result;
}

function titleForStatus(status: FeedbackStatus) {
  switch (status) {
    case "excellent":
      return "Отлично";
    case "almost":
      return "Почти";
    case "dangerous":
      return "Опасно";
    case "wrong":
      return "Нужно поправить";
  }
}

function resultError(result: CheckResult, level: Level): FeedbackErrorType {
  if (result.result === "correct") {
    return "ALMOST";
  }

  return result.errorType ?? result.evaluation.mainErrorType ?? level.mainErrorType ?? (result.result === "almost" ? "ALMOST" : "WRONG_POSITION");
}

function scoreStatus(score: number, good = 78, almost = 58): CriterionStatus {
  if (score >= good) {
    return "good";
  }

  if (score >= almost) {
    return "almost";
  }

  return "bad";
}

function ballSideForLevel(level: Level) {
  return getBallSide(level.ball, { x: 50, y: 0 });
}

function nearPostStatusText(level: Level, status: CriterionStatus) {
  const side = ballSideForLevel(level);

  if (side === "center") {
    if (status === "good") return "центр закрыт";
    if (status === "almost") return "центр почти закрыт";
    if (status === "dangerous") return "угол удара открыт";
    return "центр ворот открыт";
  }

  const sideText = side === "right" ? "правый" : "левый";

  if (status === "good") return `${sideText} угол закрыт`;
  if (status === "almost") return `${sideText} угол почти закрыт`;
  return `${sideText} ближний угол открыт`;
}

function isLineError(error: FeedbackErrorType, result: CheckResult) {
  return error === "TOO_LEFT" || error === "TOO_RIGHT" || error === "TOO_CENTRAL" || Boolean(result.evaluation.outsideShotAngle);
}

function depthStatus(result: CheckResult, error: FeedbackErrorType): CriterionStatus {
  if (error === "TOO_HIGH" || error === "RUSHED_1V1") {
    return "dangerous";
  }

  if (error === "TOO_DEEP" || error === "PASSIVE_1V1") {
    return result.result === "dangerous" ? "dangerous" : "bad";
  }

  return scoreStatus(result.evaluation.depthScore);
}

function readinessCriterion(error: FeedbackErrorType): Criterion {
  if (error === "ALMOST") {
    return { key: "readiness", label: "Готовность", status: "good", text: readinessCriterionTexts.good };
  }

  if (error === "TOO_HIGH" || error === "RUSHED_1V1") {
    return { key: "readiness", label: "Готовность", status: "dangerous", text: "сложно успеть на удар" };
  }

  if (error === "TOO_DEEP" || error === "PASSIVE_1V1") {
    return { key: "readiness", label: "Готовность", status: "bad", text: "угол удара слишком большой" };
  }

  if (error === "NEAR_POST_OPEN") {
    return { key: "readiness", label: "Готовность", status: "bad", text: "удар в ближний угол опасен" };
  }

  if (error === "NOT_ADJUSTED_AFTER_PASS" || error === "STUCK_NEAR_POST") {
    return { key: "readiness", label: "Готовность", status: "bad", text: "удар может быть из новой точки" };
  }

  if (error === "NO_BALL_VISIBILITY") {
    return { key: "readiness", label: "Готовность", status: "dangerous", text: "ты не видишь удар" };
  }

  return { key: "readiness", label: "Готовность", status: "good", text: readinessCriterionTexts.good };
}

function criterionForKey(key: CriterionKey, result: CheckResult, level: Level): Criterion {
  const error = resultError(result, level);
  const currentDepthStatus = depthStatus(result, error);
  const lineStatus = isLineError(error, result) ? (result.result === "dangerous" ? "dangerous" : "bad") : scoreStatus(result.evaluation.lineScore);
  const nearPostStatus =
    error === "NEAR_POST_OPEN"
      ? "dangerous"
      : error === "OVERPROTECTS_NEAR_POST"
        ? "bad"
        : scoreStatus(result.evaluation.nearPostScore, 74, 56);

  switch (key) {
    case "line":
    case "newBallLine":
      return {
        key,
        label: key === "newBallLine" ? "Новая линия мяча" : "Линия к мячу",
        status: lineStatus,
        text: lineCriterionTexts[lineStatus]
      };
    case "depth":
      return {
        key,
        label: "Глубина",
        status: currentDepthStatus,
        text:
          error === "TOO_HIGH" || error === "RUSHED_1V1"
            ? "слишком далеко"
            : error === "TOO_DEEP" || error === "PASSIVE_1V1"
              ? "слишком глубоко"
              : currentDepthStatus === "good"
                ? "безопасно"
                : currentDepthStatus === "almost"
                  ? "можно чуть точнее"
                  : "позиция неудачная"
      };
    case "shootingAngle":
    case "nearPost":
      return {
        key,
        label: ballSideForLevel(level) === "center" ? "Угол удара" : "Ближний угол",
        status: nearPostStatus,
        text: nearPostStatusText(level, nearPostStatus)
      };
    case "farPost":
      return {
        key,
        label: "Дальний угол",
        status: error === "OVERPROTECTS_NEAR_POST" ? "bad" : "good",
        text: farPostCriterionTexts[error === "OVERPROTECTS_NEAR_POST" ? "bad" : "good"]
      };
    case "readiness":
      return readinessCriterion(error);
    case "tooHighRisk":
      return {
        key,
        label: "Риск переброса",
        status: error === "TOO_HIGH" || error === "RUSHED_1V1" ? "dangerous" : "good",
        text: error === "TOO_HIGH" || error === "RUSHED_1V1" ? "ворота за спиной" : "выход под контролем"
      };
    case "controlledExit":
      return {
        key,
        label: "Контроль выхода",
        status: error === "RUSHED_1V1" || error === "PASSIVE_1V1" ? "dangerous" : currentDepthStatus,
        text: error === "PASSIVE_1V1" ? "слишком пассивно" : error === "RUSHED_1V1" ? "выход слишком резкий" : "угол сокращён"
      };
    case "adjustment":
      return {
        key,
        label: "Перестроение",
        status: error === "NOT_ADJUSTED_AFTER_PASS" || error === "STUCK_NEAR_POST" ? "dangerous" : "good",
        text: adjustmentCriterionTexts[error === "NOT_ADJUSTED_AFTER_PASS" || error === "STUCK_NEAR_POST" ? "dangerous" : "good"]
      };
    case "trajectory":
      return {
        key,
        label: "Траектория",
        status: scoreStatus(result.evaluation.depthScore, 76, 58),
        text: result.evaluation.depthScore >= 76 ? "траектория читается" : "выбери старт спокойнее"
      };
    case "visibility":
      return {
        key,
        label: "Обзор мяча",
        status: error === "NO_BALL_VISIBILITY" ? "dangerous" : "good",
        text: visibilityCriterionTexts[error === "NO_BALL_VISIBILITY" ? "dangerous" : "good"]
      };
    case "goalControl":
      return {
        key,
        label: "Контроль ворот",
        status: currentDepthStatus === "dangerous" ? "dangerous" : currentDepthStatus === "bad" ? "bad" : "good",
        text: currentDepthStatus === "good" ? "ворота под контролем" : "ворота теряются"
      };
    case "startingPosition":
      return {
        key,
        label: "Стартовая позиция",
        status: currentDepthStatus,
        text: currentDepthStatus === "good" ? "можно выйти на мяч" : "старт нужно поправить"
      };
    case "wall":
      const wallStatus = error === "NO_BALL_VISIBILITY" ? "dangerous" : scoreStatus(Math.min(result.evaluation.wallCountScore ?? 100, result.evaluation.wallPositionScore ?? 100), 85, 65);
      return {
        key,
        label: "Стенка",
        status: wallStatus,
        text: error === "WALL_COUNT_WRONG" ? "число игроков не подходит" : wallCriterionTexts[wallStatus]
      };
    case "openGoalPart":
      return {
        key,
        label: "Открытая часть",
        status: lineStatus === "good" ? "good" : "bad",
        text: lineStatus === "good" ? "ты в своей части ворот" : "сместись в открытую часть"
      };
    case "defenderHelp":
      return {
        key,
        label: "Защитник",
        status: error === "IGNORED_DEFENDER" ? "bad" : "good",
        text: error === "IGNORED_DEFENDER" ? "помощь защитника не учтена" : "ситуация прочитана"
      };
    case "spaceControl":
      return {
        key,
        label: "Зона за спиной",
        status: currentDepthStatus,
        text: currentDepthStatus === "good" ? "пространство контролируется" : "проверь расстояние до ворот"
      };
  }
}

function buildCriteria(result: CheckResult, level: Level) {
  const scenarioType = result.evaluation.scenarioType;
  const keys = result.result === "correct" ? criteriaByScenarioType[scenarioType].slice(0, 4) : criteriaByScenarioType[scenarioType];
  return keys.map((key) => criterionForKey(key, result, level));
}

function buildVisualHints(result: CheckResult, level: Level, criteria: Criterion[]): VisualHint[] {
  const error = resultError(result, level);
  const hints = new Set<VisualHint>(["BALL_TO_GOAL_LINE", "CURRENT_BALL_POINT", "CORRECT_ZONE", "ALMOST_ZONE"]);

  if (result.result !== "correct") {
    hints.add("MOVE_ARROW");
  }

  if (level.previousBall) {
    hints.add("PREVIOUS_BALL_POINT");
    hints.add("BALL_MOVEMENT_PATH");
  }

  if (level.freeKick) {
    hints.add("WALL_COVERAGE");
    hints.add("BALL_VISIBILITY_LINE");
  }

  if (criteria.some((criterion) => criterion.key === "visibility")) {
    hints.add("BALL_VISIBILITY_LINE");
  }

  if (criteria.some((criterion) => criterion.key === "trajectory")) {
    hints.add("CROSS_TRAJECTORY");
  }

  if (criteria.some((criterion) => criterion.key === "defenderHelp")) {
    hints.add("DEFENDER_COVERAGE");
  }

  if (criteria.some((criterion) => (criterion.key === "nearPost" || criterion.key === "shootingAngle") && criterion.status !== "good")) {
    hints.add("NEAR_POST_SECTOR");
  }

  if (error === "OVERPROTECTS_NEAR_POST") {
    hints.add("FAR_POST_SECTOR");
  }

  if (error === "TOO_HIGH" || error === "RUSHED_1V1") {
    hints.add("TOO_HIGH_ZONE");
  }

  if (error === "TOO_DEEP" || error === "PASSIVE_1V1") {
    hints.add("TOO_DEEP_ZONE");
  }

  if (error === "TOO_LEFT") {
    hints.add("TOO_LEFT_ZONE");
  }

  if (error === "TOO_RIGHT") {
    hints.add("TOO_RIGHT_ZONE");
  }

  return Array.from(hints);
}

function explainWhy(result: CheckResult, level: Level) {
  const error = resultError(result, level);

  if (result.result === "correct") {
    return excellentSummaryByScenarioType[result.evaluation.scenarioType];
  }

  if (level.previousBall) {
    return "Голубой пунктир показывает, откуда пришёл мяч. После паса позиция вратаря меняется вместе с новой точкой мяча.";
  }

  if (level.freeKick || error === "NO_BALL_VISIBILITY") {
    return "Голубая линия показывает, видишь ли ты мяч. Стенка помогает, но вратарь не должен прятаться за ней.";
  }

  if (error === "TOO_HIGH" || error === "TOO_DEEP" || error === "PASSIVE_1V1" || error === "RUSHED_1V1") {
    return "Красная зона показывает опасную глубину: слишком близко к воротам или слишком далеко от них.";
  }

  return "Белая линия показывает линию удара от мяча к центру ворот. Вратарь должен быть рядом с этой линией.";
}

function validateFeedback(feedback: FeedbackResult) {
  for (const criterion of feedback.criteria) {
    const text = criterion.text.toLowerCase();

    if ((criterion.status === "bad" || criterion.status === "dangerous") && (text.includes("закрыт") || text.includes("можешь реагировать") || text.includes("безопасно"))) {
      console.warn("Contradictory criterion feedback", criterion);
    }

    if (criterion.status === "good" && (text.includes("открыт") || text.includes("опасно") || text.includes("сложно") || text.includes("слишком"))) {
      console.warn("Contradictory good criterion", criterion);
    }
  }
}

export function buildFeedback(result: CheckResult, level: Level): FeedbackResult {
  const status = resultStatus(result);
  const error = result.result === "correct" ? undefined : resultError(result, level);
  const criteria = buildCriteria(result, level);
  const feedback: FeedbackResult = {
    status,
    title: titleForStatus(status),
    summary: status === "excellent" ? excellentSummaryByScenarioType[result.evaluation.scenarioType] : summaryByErrorType[error ?? "WRONG_POSITION"],
    criteria,
    mainAdvice: status === "excellent" ? reinforceByScenarioType[result.evaluation.scenarioType] : adviceByErrorType[error ?? "WRONG_POSITION"],
    details: {
      why: explainWhy(result, level),
      howToFix: status === "excellent" ? reinforceByScenarioType[result.evaluation.scenarioType] : adviceByErrorType[error ?? "WRONG_POSITION"]
    },
    visualHints: buildVisualHints(result, level, criteria)
  };

  validateFeedback(feedback);
  return feedback;
}
