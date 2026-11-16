import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Award, BarChart3, BookOpen, ChevronRight, Eye, Home, Lightbulb, ListChecks, Play, RotateCcw, RotateCw, Save, Settings2, Shield, Target, Volume2, VolumeX, X } from "lucide-react";
import { FieldView } from "./components/FieldView";
import { PlayerPanel } from "./components/PlayerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsPanel } from "./components/StatsPanel";
import { checkAnswer, resolveTimeoutResult } from "./domain/evaluate";
import { applyExitDecision } from "./domain/exitDecision";
import { firstAttempts, marathonPoints, type SessionAttempt } from "./domain/sessionSummary";
import { repeatReason } from "./domain/repeatReason";
import { localDate } from "./domain/calendar";
import { applyLevelVariation, mirrorLevel } from "./domain/variation";
import { RulesQuiz } from "./components/RulesQuiz";
import { PenaltyShootout } from "./components/PenaltyShootout";
import { computeBadges, isScenarioMastered, keeperRank, newlyEarnedBadges, type BadgeState } from "./domain/badges";
import { isSoundOn, playBadge, playKick, playResult, playShotOutcome, playWhistle, setSoundOn } from "./sounds";
import { shotExample } from "./domain/shotExample";
import { buildFeedback, criterionStatusText } from "./domain/feedback";
import { facingAngleToBall, normalizeAngle } from "./domain/geometry";
import { levels } from "./domain/levels";
import { pitchPresets } from "./domain/presets";
import { pitchSettingsError } from "./domain/pitchSettings";
import { criteriaByScenarioType, getBallSide, inferScenarioType, type CriterionKey } from "./domain/scenarios";
import type { CheckResult, ErrorType, Level, PitchConfig, PlayerProfile, Point, Progress, ReactionTimeSeconds, ResultKind, TrainingMode, VisualHint, WallConfig } from "./domain/types";
import {
  loadActivePlayerId,
  loadDayStreak,
  loadMarathonBest,
  loadOnboardingComplete,
  loadContextualHintSeen,
  saveContextualHintSeen,
  loadPenaltyBest,
  loadPitch,
  loadPlayerLastLevelIndex,
  loadPlayerProgress,
  loadPlayers,
  loadReactionTimeSeconds,
  loadShowDimensions,
  loadTrainingMode,
  deletePlayerData,
  deletePlayerProgress,
  parseProgressExport,
  replaceGameData,
  saveActivePlayerId,
  saveOnboardingComplete,
  savePitch,
  savePenaltyBest,
  savePlayerLastLevelIndex,
  savePlayerProgress,
  saveReactionTimeSeconds,
  savePlayers,
  saveMarathonBest,
  saveShowDimensions,
  saveTrainingMode,
  recordDayTraining,
  type DayStreak
} from "./storage";

const onboardingCards = [
  { title: "Найди мяч", visual: "ball", text: "Главное в задании — мяч. Сначала посмотри, откуда будут бить: от этого зависит, где встать." },
  { title: "Поставь вратаря", visual: "position", text: "Перетащи вратаря за белую точку под ногами. Именно она решает, попал ли он в нужную зону." },
  { title: "Поверни корпус к мячу", visual: "body", text: "Жёлтый указатель показывает поворот корпуса. Поверни указатель к мячу — так вратарь готов к удару." }
];

const contextualHintTexts = {
  analysis: "Зелёная зона — лучшая, оранжевая — допустимо. Голубая стрелка — куда переставить ноги.",
  free_kick: "Выбери число игроков и перетащи стенку. Поставь вратаря так, чтобы он видел мяч.",
  cross: "Сначала реши: выйти на мяч или остаться в воротах.",
  penalty: "До удара держи часть ноги на линии ворот."
} as const;

type ContextualHint = keyof typeof contextualHintTexts;

function OnboardingVisual({ visual }: { visual: string }) {
  const ballOnly = visual === "ball";
  const body = visual === "body";
  return (
    <div className="lesson-visual" aria-hidden="true">
      <svg className="lesson-field-svg" viewBox="0 0 160 92">
        <rect className="lesson-grass" width="160" height="92" />
        <rect className="lesson-stripe" y="18" width="160" height="18" />
        <rect className="lesson-stripe" y="54" width="160" height="18" />
        <path className="line" d="M 5 75 H 155 M 20 75 V 43 H 140 V 75 M 36 75 V 53 H 124 V 75" />
        <path d="M 62 75 L 62 84 L 98 84 L 98 75 M 62 78 L 98 78 M 62 81 L 98 81 M 68 75 L 68 84 M 74 75 L 74 84 M 80 75 L 80 84 M 86 75 L 86 84 M 92 75 L 92 84" fill="none" stroke="white" strokeWidth="0.5" opacity="0.65" />
        <path d="M 62 75 L 98 75" fill="none" stroke="white" strokeWidth="1.5" />
        <image href="/sprites/attacker-child-red-front.png" x={ballOnly ? 56 : 39} y={ballOnly ? 3 : 4} width="28" height="28" />
        {ballOnly && <circle cx="81" cy="30" r="8" fill="none" stroke="#ffcf33" strokeWidth="1" strokeDasharray="2 1" />}
        <circle cx={ballOnly ? 81 : 62} cy="30" r="3.3" fill="#fff" stroke="#111" strokeWidth="0.5" />
        <path d={ballOnly ? "M 81 28 L 83 29.5 L 82 32 L 80 32 L 79 29.5 Z" : "M 62 28 L 64 29.5 L 63 32 L 61 32 L 60 29.5 Z"} fill="#222" />
        {!ballOnly && <>
          <image href="/sprites/keeper-child-stance.png" x="65" y="42" width="30" height="30" />
          <path d={body ? "M 76 47 L 76 54 L 83 52 Z" : "M 80 49 L 77.5 53 L 82.5 53 Z"} fill="#ffcf33" stroke="#573d00" strokeWidth="0.35" />
          <circle cx="80" cy="69" r="1.4" fill="white" stroke="#173723" strokeWidth="0.4" />
        </>}
      </svg>
    </div>
  );
}

function categoryTitle(category: Level["category"]) {
  switch (category) {
    case "shot_angle":
      return "Угол";
    case "depth":
      return "Глубина";
    case "one_v_one":
      return "1-в-1";
    case "defender_pressure":
      return "Защитник";
    case "pass_reposition":
      return "Пас";
    case "cross":
      return "Навес";
    case "corner":
      return "Угловой";
    case "free_kick":
      return "Штрафной";
    case "penalty":
      return "Пенальти";
    case "reaction":
      return "Реакция";
  }
}

function trainingModeTitle(mode: TrainingMode) {
  return mode === "base_position" ? "База" : "Реакция";
}

function customSessionTitle(kind?: "weak" | "day" | "marathon") {
  if (kind === "weak") {
    return "Повтор ситуаций";
  }

  if (kind === "day") {
    return "Тренировка дня";
  }

  if (kind === "marathon") {
    return "Марафон";
  }

  return null;
}

const todayIso = localDate;

function seededShuffle<T>(items: T[], seedText: string): T[] {
  let seed = 0;

  for (let i = 0; i < seedText.length; i++) {
    seed = (seed * 31 + seedText.charCodeAt(i)) | 0;
  }

  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
    const j = Math.abs(seed) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// Подборка «Тренировки дня»: слабые места + новые сценарии + закрепление.
export function buildDayTrainingIds(progress: Progress, playerId: string, dateIso: string): string[] {
  const seedText = `${playerId}:${dateIso}`;
  const weak = seededShuffle(levels.filter((item) => progress[item.id]?.needsRepeat), seedText).slice(0, 4);
  const fresh = seededShuffle(
    levels.filter((item) => (progress[item.id]?.attempts ?? 0) === 0 && !weak.includes(item)),
    seedText
  ).slice(0, 10 - weak.length - 2);
  const rest = seededShuffle(levels.filter((item) => !weak.includes(item) && !fresh.includes(item)), seedText).slice(
    0,
    Math.max(0, 10 - weak.length - fresh.length)
  );

  return [...weak, ...fresh, ...rest].map((item) => item.id);
}

// Марафон: 10 случайных базовых сценариев, каждый запуск - новые.
function buildMarathonIds(): string[] {
  const base = levels.filter((item) => item.stage !== "reaction_to_ball_owner");
  return seededShuffle(base, `marathon:${Date.now()}`).slice(0, 10).map((item) => item.id);
}

const baseLevelCount = levels.filter((item) => item.stage !== "reaction_to_ball_owner").length;
const reactionLevelCount = levels.length - baseLevelCount;

function trainingModeDescription(mode: TrainingMode) {
  return mode === "base_position" ? `${baseLevelCount} начальных сценариев` : `${reactionLevelCount} реакционных сценариев`;
}

function resultLabel(result: CheckResult | null) {
  if (!result) {
    return "Поставь вратаря";
  }

  if (result.result === "correct") {
    return "Отлично";
  }

  if (result.result === "almost") {
    return "Почти";
  }

  if (result.result === "dangerous") {
    return "Опасно";
  }

  return "Поправь";
}

function resultClass(result: CheckResult | null) {
  if (!result) {
    return "idle";
  }

  return result.result;
}

function fieldLegendItems(visualHints: VisualHint[]) {
  const hasHint = (hint: VisualHint) => visualHints.includes(hint);

  return [
    hasHint("CORRECT_ZONE") && { kind: "green", label: "зеленая зона", text: "лучшая позиция" },
    hasHint("ALMOST_ZONE") && { kind: "orange", label: "оранжевая зона", text: "допустимо" },
    (hasHint("TOO_HIGH_ZONE") || hasHint("TOO_DEEP_ZONE")) && { kind: "red", label: "красная зона", text: "опасная глубина" },
    hasHint("BALL_TO_GOAL_LINE") && { kind: "white-line", label: "белая линия", text: "линия удара" },
    hasHint("MOVE_ARROW") && { kind: "arrow", label: "стрелка", text: "куда поправить" },
    hasHint("BALL_MOVEMENT_PATH") && { kind: "blue-line", label: "голубой пунктир", text: "положения мяча" },
    hasHint("BALL_VISIBILITY_LINE") && { kind: "blue-line", label: "голубая линия", text: "линия к мячу" }
  ].filter(Boolean) as { kind: string; label: string; text: string }[];
}

function criteriaLegendItems(criteria: { status: string }[]) {
  const statuses = new Set(criteria.map((criterion) => criterion.status));

  return [
    statuses.has("good") && { kind: "correct", text: "правильно" },
    (statuses.has("almost") || statuses.has("bad")) && { kind: "almost", text: "поправить" },
    statuses.has("dangerous") && { kind: "danger", text: "опасно" }
  ].filter(Boolean) as { kind: string; text: string }[];
}

function emptyLevelProgress() {
  return {
    attempts: 0,
    bestScore: 0,
    lastResult: "wrong" as const,
    needsRepeat: false,
    correctStreak: 0,
    wrongAttempts: 0,
    almostAttempts: 0,
    errorCounts: {}
  };
}

function updateProgress(progress: Progress, level: Level, result: CheckResult): Progress {
  const previous = {
    ...emptyLevelProgress(),
    ...(progress[level.id] ?? {})
  };
  const correctStreak = result.result === "correct" ? previous.correctStreak + 1 : 0;
  const errorType = result.errorType ?? result.evaluation.mainErrorType ?? (result.result === "correct" ? undefined : level.mainErrorType);
  const shouldCountError = result.result !== "correct" && Boolean(errorType);
  const errorCounts = {
    ...previous.errorCounts
  };

  if (shouldCountError && errorType) {
    errorCounts[errorType] = (errorCounts[errorType] ?? 0) + 1;
  }

  return {
    ...progress,
    [level.id]: {
      attempts: previous.attempts + 1,
      bestScore: Math.max(previous.bestScore, result.score),
      lastResult: result.result,
      needsRepeat: result.result !== "correct" || correctStreak < 2,
      correctStreak,
      wrongAttempts: previous.wrongAttempts + (result.result === "wrong" || result.result === "dangerous" ? 1 : 0),
      almostAttempts: previous.almostAttempts + (result.result === "almost" ? 1 : 0),
      lastErrorType: errorType,
      errorCounts
    }
  };
}

function masteredCount(progress: Progress, trainingLevels: Level[]) {
  return trainingLevels.filter((level) => isScenarioMastered(progress[level.id])).length;
}

function createPlayer(name: string): PlayerProfile {
  return {
    id: `player-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    createdAt: new Date().toISOString()
  };
}

function mostCommonError(progress: Progress): ErrorType | undefined {
  const totals = new Map<ErrorType, number>();

  Object.values(progress).forEach((item) => {
    Object.entries(item.errorCounts ?? {}).forEach(([type, count]) => {
      totals.set(type as ErrorType, (totals.get(type as ErrorType) ?? 0) + (count ?? 0));
    });
  });

  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function errorLabel(errorType?: ErrorType) {
  switch (errorType) {
    case "TOO_CENTRAL":
      return "часто остается по центру";
    case "TOO_LEFT":
      return "часто уходит слишком влево";
    case "TOO_RIGHT":
      return "часто уходит слишком вправо";
    case "TOO_DEEP":
      return "часто стоит слишком глубоко";
    case "TOO_HIGH":
      return "часто выходит слишком далеко";
    case "NEAR_POST_OPEN":
      return "чаще всего открыт ближний угол";
    case "OVERPROTECTS_NEAR_POST":
      return "часто прижимается к штанге";
    case "PASSIVE_1V1":
      return "пассивность в 1-в-1";
    case "RUSHED_1V1":
      return "слишком ранний выход";
    case "IGNORED_DEFENDER":
      return "не учитывает защитника";
    case "NOT_ADJUSTED_AFTER_PASS":
      return "не перестраивается после паса";
    case "STUCK_NEAR_POST":
      return "застревает у штанги после передачи";
    case "WRONG_BODY_ANGLE":
      return "корпус не повернут к мячу";
    case "WRONG_EXIT_DECISION":
      return "решение на подаче стоит потренировать";
    case "NO_BALL_VISIBILITY":
      return "теряет обзор мяча за стенкой";
    case "WALL_COUNT_WRONG":
      return "ошибается с числом игроков в стенке";
    case "WALL_POSITION_WRONG":
      return "стенка не закрывает ближний угол";
    case "TOO_LATE_REACTION":
      return "часто не успевает занять позицию";
    case "WRONG_BALL_OWNER":
      return "реагирует не на игрока с мячом";
    default:
      return "нет слабых мест";
  }
}

function startGoalkeeperForLevel(level: Level, index: number): Point {
  const yVariants = [-3.2, 0.25, 1.15];

  return {
    x: Math.max(12, Math.min(88, level.initialGoalkeeper.x)),
    y: yVariants[index % yVariants.length]
  };
}

function startFacingForLevel(level: Level, goalkeeper: Point, index: number, pitch: PitchConfig) {
  const targetFacing = facingAngleToBall(goalkeeper, level.ball, pitch);
  const wrongTurn = index % 2 === 0 ? -105 : 105;

  return normalizeAngle(targetFacing + wrongTurn);
}

function startWallForLevel(level: Level): WallConfig {
  return level.freeKick?.initialWall ?? { count: 0, x: 50, y: 8 };
}

type CriterionStatus = "good" | "almost" | "bad";

type Criterion = {
  key: string;
  label: string;
  status: CriterionStatus;
  text: string;
};

function scoreStatus(score: number, good = 78, almost = 58): CriterionStatus {
  if (score >= good) {
    return "good";
  }

  if (score >= almost) {
    return "almost";
  }

  return "bad";
}

function statusText(status: CriterionStatus) {
  switch (status) {
    case "good":
      return "хорошо";
    case "almost":
      return "поправить";
    case "bad":
      return "опасно";
  }
}

function resultError(result: CheckResult, level: Level) {
  if (result.result === "correct") {
    return undefined;
  }

  return result.errorType ?? result.evaluation.mainErrorType ?? level.mainErrorType;
}

function ballSideForLevel(level: Level) {
  return getBallSide(level.ball, { x: 50, y: 0 });
}

function nearPostSide(level: Level) {
  const side = ballSideForLevel(level);

  if (side === "center") {
    return "центр";
  }

  return side === "right" ? "правый" : "левый";
}

function nearPostLabel(level: Level) {
  return ballSideForLevel(level) === "center" ? "Угол удара" : "Ближний угол";
}

function nearPostText(level: Level, status: CriterionStatus) {
  const side = ballSideForLevel(level);

  if (side === "center") {
    if (status === "good") {
      return "центр закрыт";
    }

    if (status === "almost") {
      return "центр почти закрыт";
    }

    return "центр ворот открыт";
  }

  const sideText = side === "right" ? "правый" : "левый";

  if (status === "good") {
    return `${sideText} угол закрыт`;
  }

  if (status === "almost") {
    return `${sideText} угол почти закрыт`;
  }

  return `${sideText} ближний угол открыт`;
}

function openAngleText(level: Level) {
  return ballSideForLevel(level) === "center" ? "центр ворот открыт" : `${nearPostSide(level)} угол открыт`;
}

function isLineError(error?: ErrorType) {
  return error === "TOO_LEFT" || error === "TOO_RIGHT" || error === "TOO_CENTRAL";
}

function lineAdviceText(error?: ErrorType) {
  if (error === "TOO_LEFT") {
    return "сместись правее к линии мяча";
  }

  if (error === "TOO_RIGHT") {
    return "сместись левее к линии мяча";
  }

  return "сместись к линии мяча";
}

function positiveLead(result: CheckResult, level: Level) {
  const error = resultError(result, level);

  if (!isLineError(error) && !result.evaluation.outsideShotAngle && result.evaluation.lineScore >= 72) {
    return "Ты правильно сместился к мячу";
  }

  if (result.evaluation.depthScore >= 72) {
    return "Ты выбрал неплохую глубину";
  }

  if (result.evaluation.orientationScore >= 72) {
    return "Ты развернулся к мячу";
  }

  return "Ты начал искать позицию";
}

function isDangerousCriterion(result: CheckResult, error?: ErrorType) {
  return (
    result.result === "dangerous" ||
    error === "TOO_HIGH" ||
    error === "RUSHED_1V1" ||
    error === "NEAR_POST_OPEN" ||
    error === "NO_BALL_VISIBILITY"
  );
}

function readinessText(error?: ErrorType) {
  switch (error) {
    case "TOO_HIGH":
    case "RUSHED_1V1":
      return "сложно вернуться назад";
    case "TOO_DEEP":
    case "PASSIVE_1V1":
      return "ворота выглядят больше";
    case "NEAR_POST_OPEN":
      return "удар в ближний угол опасен";
    case "NO_BALL_VISIBILITY":
      return "мяч плохо видно";
    default:
      return "можешь реагировать";
  }
}

function feedbackSummary(result: CheckResult, level: Level) {
  if (result.result === "correct") {
    if (level.category === "free_kick") {
      return "Ты правильно выставил стенку, видишь мяч и занял открытую часть ворот.";
    }

    if (level.category === "penalty") {
      return "Ты на линии ворот по центру, как требуют правила, и готов оттолкнуться в любую сторону.";
    }

    if (level.category === "cross" || level.category === "corner") {
      return "Ты выбрал безопасную стартовую зону, видишь мяч и готов двигаться по траектории.";
    }

    return "Ты правильно выбрал игровую зону и закрыл угол удара.";
  }

  const error = resultError(result, level);

  if (level.category === "penalty" && (error === "TOO_HIGH" || error === "RUSHED_1V1")) {
    return "По правилам пенальти до удара хотя бы часть одной ноги должна оставаться на линии ворот. Если выйти раньше, удар могут заставить перебить.";
  }

  const lead = positiveLead(result, level);

  switch (resultError(result, level)) {
    case "TOO_HIGH":
      return `${lead}, но вышел слишком далеко. Ворота остались за спиной, и нападающий может перебросить.`;
    case "RUSHED_1V1":
      return `${lead}, но слишком резко выбежал. Нужно остановиться перед ударом, чтобы успеть среагировать.`;
    case "TOO_DEEP":
      return `${lead}, но стоишь слишком близко к линии ворот. Из-за этого нападающему видно больше ворот.`;
    case "PASSIVE_1V1":
      return `${lead}, но остался слишком глубоко. В 1-в-1 нужно сократить угол.`;
    case "TOO_CENTRAL":
      return `${lead}, но позиция осталась слишком центральной. ${openAngleText(level)}.`;
    case "TOO_LEFT":
    case "TOO_RIGHT":
      return `${lead}, но точка ног ушла с линии мяча. Нужно вернуться внутрь угла удара.`;
    case "NEAR_POST_OPEN":
      return `${lead}, но ${openAngleText(level)}. С этой позиции туда легко пробить.`;
    case "OVERPROTECTS_NEAR_POST":
      return `${lead}, но слишком прижался к ближней штанге. Дальняя часть ворот открыта.`;
    case "NOT_ADJUSTED_AFTER_PASS":
    case "STUCK_NEAR_POST":
      return `${lead}, но мяч уже в другой точке. Позицию нужно поменять под новую линию мяча.`;
    case "NO_BALL_VISIBILITY":
      return `${lead}, но не видишь мяч из-за стенки. Вратарю нужно видеть удар.`;
    case "WALL_COUNT_WRONG":
      return `${lead}, но для этого штрафного нужно другое число игроков в стенке.`;
    case "WALL_POSITION_WRONG":
      return `${lead}, но стенка стоит не на той линии и не закрывает ближний угол.`;
    case "WRONG_BODY_ANGLE":
      return `${lead}, но корпус нужно точнее повернуть к мячу.`;
    default:
      return result.result === "almost" ? `${lead}, но один критерий нужно поправить.` : `${lead}, но позиция пока не защищает ворота от этой точки мяча.`;
  }
}

function mainAdvice(result: CheckResult, level: Level) {
  if (result.result === "correct") {
    if (level.category === "penalty") {
      return "Запомни правило пенальти: до удара оставайся на линии ворот, отойти от нее можно только после удара.";
    }

    return "Запомни правило: встань на линию мяча, выбери безопасную глубину и будь готов к удару.";
  }

  if (level.category === "penalty" && (resultError(result, level) === "TOO_HIGH" || resultError(result, level) === "RUSHED_1V1")) {
    return "Вернись на линию ворот: при пенальти правило разрешает покинуть ее только после удара.";
  }

  switch (resultError(result, level)) {
    case "TOO_HIGH":
    case "RUSHED_1V1":
      return "Сделай маленький шаг назад к воротам.";
    case "TOO_DEEP":
    case "PASSIVE_1V1":
      return "Выйди на маленький шаг вперёд и останься на линии мяча.";
    case "TOO_LEFT":
      return "Сместись правее к линии мяча.";
    case "TOO_RIGHT":
      return "Сместись левее к линии мяча.";
    case "TOO_CENTRAL":
    case "NEAR_POST_OPEN":
      return "Сместись к стороне мяча и закрой ближний угол.";
    case "OVERPROTECTS_NEAR_POST":
      return "Отойди чуть от штанги к центру ворот.";
    case "NOT_ADJUSTED_AFTER_PASS":
    case "STUCK_NEAR_POST":
      return "Двигайся за новой точкой мяча.";
    case "WRONG_BODY_ANGLE":
      return "Оставь позицию ног и поверни корпус к мячу.";
    case "WALL_COUNT_WRONG":
      return "Подбери число игроков в стенке под опасность удара.";
    case "WALL_POSITION_WRONG":
      return "Поставь стенку на линию удара к ближней штанге.";
    case "NO_BALL_VISIBILITY":
      return "Стань так, чтобы видеть мяч рядом со стенкой.";
    case "IGNORED_DEFENDER":
      return "Оцени, успевает ли защитник закрыть удар, и не выбегай без причины.";
    default:
      return "Найди линию от мяча к центру ворот и выбери безопасную глубину.";
  }
}

function criterionForKey(key: CriterionKey, result: CheckResult, level: Level): Criterion {
  const error = resultError(result, level);
  const nearPostStatus = error === "NEAR_POST_OPEN" ? "bad" : error === "OVERPROTECTS_NEAR_POST" ? "almost" : scoreStatus(result.evaluation.nearPostScore, 74, 56);
  const depthStatus =
    error === "TOO_HIGH" || error === "RUSHED_1V1"
      ? "bad"
      : error === "TOO_DEEP" || error === "PASSIVE_1V1"
        ? "almost"
        : scoreStatus(result.evaluation.depthScore);

  switch (key) {
    case "line":
    case "newBallLine":
      const lineError = isLineError(error) || result.evaluation.outsideShotAngle;
      return {
        key,
        label: key === "newBallLine" ? "Новая линия мяча" : "Линия к мячу",
        status: lineError ? (result.result === "dangerous" ? "bad" : "almost") : scoreStatus(result.evaluation.lineScore),
        text: lineError ? lineAdviceText(error) : result.evaluation.lineScore >= 78 ? "смещение верное" : "сместись к линии мяча"
      };
    case "depth":
      return {
        key,
        label: "Глубина",
        status: depthStatus,
        text:
          error === "TOO_HIGH" || error === "RUSHED_1V1"
            ? "слишком далеко"
            : error === "TOO_DEEP" || error === "PASSIVE_1V1"
              ? "слишком глубоко"
              : result.evaluation.depthScore >= 78
                ? "безопасно"
                : "можно точнее"
      };
    case "shootingAngle":
      return {
        key,
        label: "Угол удара",
        status: nearPostStatus,
        text: nearPostText(level, nearPostStatus)
      };
    case "nearPost":
      return {
        key,
        label: nearPostLabel(level),
        status: nearPostStatus,
        text: nearPostText(level, nearPostStatus)
      };
    case "farPost":
      return {
        key,
        label: "Дальняя часть",
        status: error === "OVERPROTECTS_NEAR_POST" ? "bad" : "good",
        text: error === "OVERPROTECTS_NEAR_POST" ? "дальняя часть открыта" : "ворота сбалансированы"
      };
    case "readiness":
      return {
        key,
        label: "Готовность",
        status: isDangerousCriterion(result, error) ? "bad" : result.evaluation.orientationScore >= 55 ? "good" : "almost",
        text: readinessText(error)
      };
    case "tooHighRisk":
      return {
        key,
        label: "Риск переброса",
        status: error === "TOO_HIGH" || error === "RUSHED_1V1" ? "bad" : "good",
        text: error === "TOO_HIGH" || error === "RUSHED_1V1" ? "ворота за спиной" : "выход под контролем"
      };
    case "controlledExit":
      return {
        key,
        label: "Выход из ворот",
        status: error === "RUSHED_1V1" || error === "PASSIVE_1V1" ? "bad" : depthStatus,
        text: error === "PASSIVE_1V1" ? "слишком пассивно" : error === "RUSHED_1V1" ? "выход слишком резкий" : "угол сокращен"
      };
    case "adjustment":
      return {
        key,
        label: "Перестроение",
        status: error === "NOT_ADJUSTED_AFTER_PASS" || error === "STUCK_NEAR_POST" ? "bad" : "good",
        text: error === "NOT_ADJUSTED_AFTER_PASS" || error === "STUCK_NEAR_POST" ? "позиция осталась старой" : "учтена новая точка мяча"
      };
    case "trajectory":
      return {
        key,
        label: "Траектория",
        status: scoreStatus(result.evaluation.depthScore, 76, 58),
        text: result.evaluation.depthScore >= 76 ? "стартовая зона безопасная" : "выбери старт спокойнее"
      };
    case "visibility":
      return {
        key,
        label: "Обзор мяча",
        status: error === "NO_BALL_VISIBILITY" ? "bad" : "good",
        text: error === "NO_BALL_VISIBILITY" ? "мяч скрыт игроками" : "мяч виден"
      };
    case "goalControl":
      return {
        key,
        label: "Контроль ворот",
        status: depthStatus === "bad" ? "bad" : "good",
        text: depthStatus === "bad" ? "ворота потеряны" : "ворота под контролем"
      };
    case "startingPosition": {
      const sideMiss = error === "TOO_LEFT" || error === "TOO_RIGHT";
      return {
        key,
        label: "Стартовая позиция",
        status: sideMiss ? "bad" : depthStatus,
        text: sideMiss ? "вернись в стартовую стойку" : depthStatus === "good" ? "можно выйти на мяч" : "старт спорный"
      };
    }
    case "wall":
      return {
        key,
        label: "Стенка",
        status: scoreStatus(Math.min(result.evaluation.wallCountScore ?? 100, result.evaluation.wallPositionScore ?? 100), 85, 65),
        text: error === "WALL_COUNT_WRONG" ? "число игроков не подходит" : error === "WALL_POSITION_WRONG" ? "линия стенки неточная" : "закрывает опасную часть"
      };
    case "openGoalPart":
      return {
        key,
        label: "Открытая часть",
        status: scoreStatus(result.evaluation.lineScore, 76, 58),
        text: result.evaluation.lineScore >= 76 ? "вратарь в своей части" : "сместись в открытую часть ворот"
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
        status: depthStatus,
        text: depthStatus === "good" ? "пространство контролируется" : "проверь расстояние до ворот"
      };
    case "ballOwner":
      return {
        key,
        label: "Игрок с мячом",
        status: error === "WRONG_BALL_OWNER" ? "bad" : "good",
        text: error === "WRONG_BALL_OWNER" ? "смотри на активный мяч" : "главная угроза найдена"
      };
    case "reactionTime":
      return {
        key,
        label: "Время реакции",
        status: error === "TOO_LATE_REACTION" ? "bad" : "good",
        text: error === "TOO_LATE_REACTION" ? "не успел занять позицию" : "успел до удара"
      };
  }
}

function buildCriteria(result: CheckResult, level: Level): Criterion[] {
  if (result.result === "correct") {
    return (["line", "depth", "nearPost", "readiness"] satisfies CriterionKey[]).map((key) => criterionForKey(key, result, level));
  }

  return criteriaByScenarioType[result.evaluation.scenarioType].map((key) => criterionForKey(key, result, level));
}

function explainDecision(result: CheckResult | null, level: Level) {
  if (!result) {
    return "Поставь вратаря так, чтобы он был между мячом и серединой ворот. Потом разверни корпус к мячу.";
  }

  if (result.result === "correct") {
    if (level.category === "free_kick") {
      return "Стенка закрыла ближний угол, а вратарь занял середину открытой части ворот. Теперь удару через стенку и в свободную часть сложнее пройти.";
    }

    if (level.category === "cross") {
      return "Ты прочитал навес как высокий мяч: не бросил ворота, держишь траекторию и готов к мячу под перекладину или на дальнюю штангу.";
    }

    if (level.category === "corner") {
      return "При угловом важно стартовать там, где виден мяч, ворота под контролем и есть возможность выйти на подачу.";
    }

    if (level.category === "one_v_one") {
      return "Ты сократил угол: нападающему стало сложнее пробить мимо тебя.";
    }

    if (level.category === "pass_reposition") {
      return "Ты перестроился за мячом. Это важно: новая позиция мяча всегда меняет позицию вратаря.";
    }

    if (level.category === "defender_pressure") {
      return "Ты не дернулся лишний раз и держишь ворота, пока защитник мешает игроку с мячом.";
    }

    return "Ты стоишь на линии мяча и закрыл ближний угол. Так ворота для нападающего становятся меньше.";
  }

  const errorType = result.errorType ?? result.evaluation.mainErrorType ?? level.mainErrorType;

  switch (errorType) {
    case "WALL_COUNT_WRONG":
      return "Для штрафного сначала выбери правильное число игроков в стенке. Слишком маленькая стенка оставит ближний угол, слишком большая заберет лишних защитников.";
    case "WALL_POSITION_WRONG":
      return "Стенка должна стоять на линии удара к ближней штанге и закрывать ближний угол. Вратарь отвечает за открытую часть ворот.";
    case "NEAR_POST_OPEN":
      return "Смотри на штангу рядом с мячом. Если она открыта, нападающий получает простой удар.";
    case "OVERPROTECTS_NEAR_POST":
      return "Закрыть ближний угол не значит прижаться к штанге. Нужно оставить под контролем и дальнюю часть ворот.";
    case "TOO_DEEP":
      return "Ты слишком близко к воротам. Сделай шаг вперед, чтобы уменьшить угол удара.";
    case "TOO_HIGH":
      return "Выходить вперед полезно, но только до безопасной границы. Если выйти слишком далеко, нападающий может перебросить мяч за спину.";
    case "PASSIVE_1V1":
      return "В 1-в-1 нельзя просто ждать на линии. Нужно выйти и сделать ворота меньше.";
    case "RUSHED_1V1":
      return "Выходить нужно быстро, но перед ударом лучше остановиться и быть готовым.";
    case "IGNORED_DEFENDER":
      return "Посмотри на защитника. Если он уже давит на игрока, не всегда нужно выбегать.";
    case "NOT_ADJUSTED_AFTER_PASS":
      return "Мяч ушел в другую точку, значит и твоя позиция должна поменяться.";
    case "STUCK_NEAR_POST":
      return "После прострела или отката нельзя застывать у первой штанги. Вратарь двигается за новой точкой мяча.";
    case "WRONG_BODY_ANGLE":
      return "Вратарь должен смотреть корпусом на мяч. Так легче сделать первый шаг и не потерять ближний угол.";
    case "NO_BALL_VISIBILITY":
      return "Стенка помогает закрыть часть ворот, но вратарь обязан видеть мяч, чтобы среагировать на удар.";
    case "TOO_LEFT":
    case "TOO_RIGHT":
    case "TOO_CENTRAL":
      return "Проверь линию от мяча к середине ворот. Вратарь должен быть рядом с этой линией.";
    default:
      return "Посмотри на мяч, ближний угол и расстояние до ворот. Эти три вещи подскажут позицию.";
  }
}

function placementAdvice(result: CheckResult | null, goalkeeper: Point) {
  if (!result) {
    return "Ищи зону на линии от мяча к середине ворот. Не оставайся на линии ворот или внутри ворот, а корпус поверни к мячу.";
  }

  const optimal = result.evaluation.optimalPoint;
  const dx = optimal.x - goalkeeper.x;
  const dy = optimal.y - goalkeeper.y;
  const horizontal = Math.abs(dx) < 3 ? "по ширине почти верно" : dx > 0 ? "сместись правее" : "сместись левее";
  const vertical = Math.abs(dy) < 3 ? "глубина почти верная" : dy > 0 ? "выйди чуть вперед от ворот" : "стань чуть ближе к воротам";

  if (result.result === "correct") {
    return "Оставайся на линии мяча, корпус разверни к мячу, ноги готовы к движению.";
  }

  if ((result.errorType ?? result.evaluation.mainErrorType) === "WRONG_BODY_ANGLE") {
    return "Как надо: оставь точку ног, но поверни корпус к мячу кнопками поворота.";
  }

  if ((result.errorType ?? result.evaluation.mainErrorType) === "WALL_COUNT_WRONG") {
    return "Как надо: число игроков в стенке указано в задании. Поставь столько игроков, сколько нужно, потом двигай стенку к ближнему углу.";
  }

  if ((result.errorType ?? result.evaluation.mainErrorType) === "WALL_POSITION_WRONG") {
    return "Как надо: стенка закрывает ближнюю штангу, а вратарь стоит в центре оставшейся открытой части ворот.";
  }

  return `Как надо: ${horizontal}, ${vertical}. На поле зеленая зона показывает безопасный диапазон, а не одну единственную точку.`;
}

export function App() {
  const [firstVisit] = useState(() => !localStorage.getItem("goalkeeper-sim:players"));
  const [players, setPlayers] = useState<PlayerProfile[]>(() => loadPlayers());
  const [activePlayerId, setActivePlayerId] = useState(() => {
    const loadedPlayers = loadPlayers();
    return loadActivePlayerId(loadedPlayers);
  });
  const [playerSelected, setPlayerSelected] = useState(false);
  const [menuStep, setMenuStep] = useState<"player" | "pitch" | "training" | "data">("player");
  const [dataReturnStep, setDataReturnStep] = useState<"player" | "pitch" | "training">("player");
  const [hasEnteredGame, setHasEnteredGame] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [pitch, setPitch] = useState<PitchConfig>(() => loadPitch());
  const [progress, setProgress] = useState<Progress>(() => loadPlayerProgress(loadActivePlayerId(loadPlayers())));
  const [levelIndex, setLevelIndex] = useState(0);
  const [mirroredLevelId, setMirroredLevelId] = useState<string | null>(null);
  const [similarMessage, setSimilarMessage] = useState<string | null>(null);
  const [goalkeeper, setGoalkeeper] = useState<Point>(() => startGoalkeeperForLevel(levels[0], 0));
  const [goalkeeperFacing, setGoalkeeperFacing] = useState(() => startFacingForLevel(levels[0], startGoalkeeperForLevel(levels[0], 0), 0, pitch));
  const [wall, setWall] = useState<WallConfig>(() => startWallForLevel(levels[0]));
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [whyVisible, setWhyVisible] = useState(false);
  const [showDimensions, setShowDimensions] = useState(() => loadShowDimensions());
  const [onboardingComplete, setOnboardingComplete] = useState(() => loadOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [contextualHint, setContextualHint] = useState<{ kind: ContextualHint; levelId: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsPlayerId, setStatsPlayerId] = useState(() => activePlayerId);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>(() => loadTrainingMode());
  const [reactionTimeSeconds, setReactionTimeSeconds] = useState<ReactionTimeSeconds>(() => loadReactionTimeSeconds());
  const [draftPitch, setDraftPitch] = useState<PitchConfig>(() => pitch);
  const [draftShowDimensions, setDraftShowDimensions] = useState(showDimensions);
  const [draftReactionTimeSeconds, setDraftReactionTimeSeconds] = useState<ReactionTimeSeconds>(() => reactionTimeSeconds);
  const [reactionPhase, setReactionPhase] = useState<"waiting" | "active">("waiting");
  const [reactionTimeLeft, setReactionTimeLeft] = useState<number | null>(null);
  const [rulesQuizOpen, setRulesQuizOpen] = useState(false);
  const [shootoutOpen, setShootoutOpen] = useState(false);
  const [penaltyBest, setPenaltyBest] = useState<number | null>(null);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [soundOn, setSoundOnState] = useState(() => isSoundOn());
  // Сначала летит мяч и виден исход (гол/сейв), и только затем появляются
  // зоны, вердикт и разбор - как в настоящем эпизоде.
  const [analysisRevealed, setAnalysisRevealed] = useState(true);
  const [alternativePlayerId, setAlternativePlayerId] = useState<string | null>(null);
  const [badgeToast, setBadgeToast] = useState<BadgeState | null>(null);
  const badgeToastTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  // Подсказка «установи как приложение»: Chrome/Android дает событие установки,
  // на iOS показываем инструкцию. Живет в сворачиваемом блоке меню «Данные и установка».
  const [installPromptEvent, setInstallPromptEvent] = useState<(Event & { prompt: () => Promise<unknown> }) | null>(null);
  const isIosBrowser =
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as Event & { prompt: () => Promise<unknown> });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);
  // Специальные сессии: «Слабые места», «Тренировка дня», «Марафон».
  // Список сценариев фиксируется на момент запуска, чтобы не менялся по ходу.
  const [customSession, setCustomSession] = useState<{ kind: "weak" | "day" | "marathon"; ids: string[] } | null>(null);
  // Журнал текущей сессии для экрана итогов.
  const [sessionLog, setSessionLog] = useState<SessionAttempt[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const reactionPaused = !playerSelected || !onboardingComplete || settingsOpen || statsOpen || rulesQuizOpen || shootoutOpen || summaryOpen;
  const [dayStreak, setDayStreak] = useState<DayStreak | null>(null);
  const [marathonBest, setMarathonBest] = useState<number | null>(null);
  const trainingLevels = useMemo(() => {
    if (customSession) {
      const sessionLevels = customSession.ids
        .map((id) => levels.find((item) => item.id === id))
        .filter((item): item is Level => Boolean(item));

      if (sessionLevels.length > 0) {
        return sessionLevels;
      }
    }

    return levels.filter((item) => (trainingMode === "base_position" ? item.stage !== "reaction_to_ball_owner" : item.stage === "reaction_to_ball_owner"));
  }, [trainingMode, customSession]);
  const rawLevel = trainingLevels[Math.min(levelIndex, trainingLevels.length - 1)] ?? trainingLevels[0] ?? levels[0];
  // Вариация координат фиксируется при входе в уровень (по числу прошлых попыток),
  // чтобы поле не менялось между ответом и разбором.
  const variationRef = useRef<{ levelId: string; attempt: number } | null>(null);

  if (variationRef.current?.levelId !== rawLevel.id) {
    variationRef.current = { levelId: rawLevel.id, attempt: progress[rawLevel.id]?.attempts ?? 0 };
  }

  const variationAttempt = variationRef.current.attempt;
  // Пенальти пробивается с точки пенальти активного пресета,
  // поэтому мяч и бьющий подгоняются под разметку.
  const basePreparedLevel = useMemo<Level>(() => {
    if (rawLevel.scenarioType !== "penalty") {
      return applyLevelVariation(rawLevel, variationAttempt);
    }

    const levelPitch = rawLevel.pitchPresetOverride ? pitchPresets[rawLevel.pitchPresetOverride] : pitch;
    const spotDistance = levelPitch.markings.penaltySpotDistance;

    if (!spotDistance) {
      return rawLevel;
    }

    const spotY = (spotDistance / levelPitch.fieldLength) * 100;

    return {
      ...rawLevel,
      ball: { x: 50, y: spotY },
      players: rawLevel.players.map((player) => (player.hasBall ? { ...player, y: spotY + 4 } : player))
    };
  }, [pitch, rawLevel, variationAttempt]);
  const preparedLevel = useMemo(
    () => mirroredLevelId === rawLevel.id ? mirrorLevel(basePreparedLevel) : basePreparedLevel,
    [basePreparedLevel, mirroredLevelId, rawLevel.id]
  );
  // Пас во время отсчета: после срабатывания мяч уходит к другому игроку,
  // старая точка мяча остается для проверки перестроения.
  const [reactionPassDone, setReactionPassDone] = useState(false);
  const [exitChoice, setExitChoice] = useState<"go" | "stay" | null>(null);
  const level = useMemo<Level>(() => {
    if (!reactionPassDone || !preparedLevel.reactionPass) {
      return preparedLevel;
    }

    const receiver = preparedLevel.players.find((player) => player.id === preparedLevel.reactionPass?.toPlayerId);

    if (!receiver) {
      return preparedLevel;
    }

    return {
      ...preparedLevel,
      previousBall: preparedLevel.ball,
      ball: { x: receiver.x, y: receiver.y },
      activatedBallOwnerId: receiver.id
    };
  }, [preparedLevel, reactionPassDone]);
  const isReactionLevel = level.stage === "reaction_to_ball_owner";
  const effectiveReactionSeconds = isReactionLevel ? reactionTimeSeconds : null;
  const reactionActive = !isReactionLevel || reactionPhase === "active" || Boolean(result);
  const displayedLevel = useMemo<Level>(() => {
    if (!isReactionLevel) {
      return level;
    }

    return {
      ...level,
      players: level.players.map((player) => ({
        ...player,
        hasBall: reactionActive && player.id === level.activatedBallOwnerId
      }))
    };
  }, [isReactionLevel, level, reactionActive]);
  const alternativeAttackers = displayedLevel.players.filter((player) => player.role === "attacker" && !player.hasBall);
  useEffect(() => {
    if (!result) setAlternativePlayerId(null);
  }, [result, level.id]);
  const activePitch = level.pitchPresetOverride ? pitchPresets[level.pitchPresetOverride] : pitch;
  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const savedLevelIndex = Math.min(trainingLevels.length - 1, loadPlayerLastLevelIndex(activePlayerId, trainingMode));
  const hasTrainingToContinue = savedLevelIndex > 0 || trainingLevels.some((item) => (progress[item.id]?.attempts ?? 0) > 0);
  const feedback = useMemo(() => (result ? buildFeedback(result, level) : null), [level, result]);
  const shownFeedback = analysisRevealed ? feedback : null;
  const visibleFieldLegend = useMemo(() => fieldLegendItems(shownFeedback?.visualHints ?? []), [shownFeedback]);
  const marathonScore = useMemo(
    () => (customSession?.kind === "marathon" ? marathonPoints(sessionLog) : null),
    [customSession, sessionLog]
  );

  useEffect(() => {
    // Скрытие выставляется синхронно в submitAnswer (иначе разметка мигает
    // один кадр); здесь только раскрытие после полета мяча.
    if (!result || analysisRevealed) {
      return;
    }

    const revealTimer = window.setTimeout(() => setAnalysisRevealed(true), 1300);

    return () => window.clearTimeout(revealTimer);
  }, [result, analysisRevealed]);
  useEffect(() => {
    if (!playerSelected || !onboardingComplete) return;
    if (contextualHint && contextualHint.levelId !== level.id) {
      setContextualHint(null);
      return;
    }
    if (contextualHint) return;

    const categoryHint = level.category === "free_kick" || level.category === "cross" || level.category === "penalty" ? level.category : null;
    const nextHint = categoryHint && !result && !loadContextualHintSeen(categoryHint)
      ? categoryHint
      : result && analysisRevealed && !loadContextualHintSeen("analysis") ? "analysis" : null;
    if (nextHint) {
      saveContextualHintSeen(nextHint);
      setContextualHint({ kind: nextHint, levelId: level.id });
    }
  }, [playerSelected, onboardingComplete, contextualHint, level.id, level.category, result, analysisRevealed]);

  const statsProgressByPlayer = useMemo(() => {
    return Object.fromEntries(players.map((player) => [player.id, player.id === activePlayerId ? progress : loadPlayerProgress(player.id)]));
  }, [activePlayerId, players, progress, statsRefreshKey]);
  const statsPlayer = players.find((player) => player.id === statsPlayerId) ?? activePlayer;

  const weakSpotsCount = useMemo(() => levels.filter((item) => progress[item.id]?.needsRepeat).length, [progress]);
  const masteredAllCount = useMemo(() => levels.filter((item) => isScenarioMastered(progress[item.id])).length, [progress]);

  const weakTopic = useMemo(() => {
    const repeated = trainingLevels.find((item) => progress[item.id]?.needsRepeat);
    return repeated ? categoryTitle(repeated.category) : "нет слабых тем";
  }, [progress, trainingLevels]);

  const commonError = useMemo(() => errorLabel(mostCommonError(progress)), [progress]);

  useEffect(() => {
    savePlayers(players);
  }, [players]);

  useEffect(() => {
    saveActivePlayerId(activePlayerId);
    setProgress(loadPlayerProgress(activePlayerId));
    setResult(null);
    setHintVisible(false);
    setWhyVisible(false);
    setStatsPlayerId(activePlayerId);
    setPenaltyBest(loadPenaltyBest(activePlayerId));
    setDayStreak(loadDayStreak(activePlayerId));
    setMarathonBest(loadMarathonBest(activePlayerId));
    setSessionLog([]);
  }, [activePlayerId]);

  useEffect(() => {
    savePitch(pitch);
  }, [pitch]);

  useEffect(() => {
    saveTrainingMode(trainingMode);
  }, [trainingMode]);

  useEffect(() => {
    saveReactionTimeSeconds(reactionTimeSeconds);
  }, [reactionTimeSeconds]);

  useEffect(() => {
    savePlayerProgress(activePlayerId, progress);
  }, [progress]);

  useEffect(() => {
    saveShowDimensions(showDimensions);
  }, [showDimensions]);

  useEffect(() => {
    if (customSession) {
      moveToLevel(0, false);
      return;
    }

    const nextIndex = Math.min(trainingLevels.length - 1, loadPlayerLastLevelIndex(activePlayerId, trainingMode));
    moveToLevel(nextIndex, false);
  }, [activePlayerId, trainingMode, trainingLevels.length, customSession]);

  useEffect(() => {
    if (!isReactionLevel) {
      setReactionPhase("active");
      setReactionTimeLeft(null);
      return;
    }
    if (reactionPaused || result || reactionPhase !== "waiting") return;
    const activationTimer = window.setTimeout(() => {
      setReactionPhase("active");
      setReactionTimeLeft(effectiveReactionSeconds);
      playWhistle();
    }, level.ballOwnerActivationDelayMs ?? 1200);

    return () => window.clearTimeout(activationTimer);
  }, [effectiveReactionSeconds, isReactionLevel, level.ballOwnerActivationDelayMs, level.id, reactionPaused, reactionPhase, result]);

  useEffect(() => {
    if (reactionPaused || !isReactionLevel || reactionPhase !== "active" || result || reactionTimeLeft === null) {
      return;
    }

    if (reactionTimeLeft <= 0) {
      submitAnswer("timeout");
      return;
    }

    // Пас во время отсчета: мяч уходит к другому игроку, таймер продолжает идти.
    if (level.reactionPass && !reactionPassDone && reactionTimeLeft <= level.reactionPass.atRemainingSeconds) {
      setReactionPassDone(true);
      playKick(0);
    }

    const countdownTimer = window.setTimeout(() => {
      setReactionTimeLeft((current) => (current === null ? current : Math.max(0, current - 1)));
    }, 1000);

    return () => window.clearTimeout(countdownTimer);
  }, [isReactionLevel, reactionPhase, reactionTimeLeft, reactionPaused, result, level.reactionPass, reactionPassDone]);

  function moveToLevel(nextIndex: number, shouldSave = true) {
    const safeIndex = Math.max(0, Math.min(trainingLevels.length - 1, nextIndex));
    const nextLevel = trainingLevels[safeIndex];
    const nextGoalkeeper = startGoalkeeperForLevel(nextLevel, safeIndex);
    setLevelIndex(safeIndex);
    setMirroredLevelId(null);
    setSimilarMessage(null);
    setGoalkeeper(nextGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(nextLevel, nextGoalkeeper, safeIndex, nextLevel.pitchPresetOverride ? pitchPresets[nextLevel.pitchPresetOverride] : pitch));
    setWall(startWallForLevel(nextLevel));
    setResult(null);
    setHintVisible(false);
    setWhyVisible(false);
    setReactionPhase(nextLevel.stage === "reaction_to_ball_owner" ? "waiting" : "active");
    setReactionTimeLeft(null);
    setReactionPassDone(false);
    setExitChoice(null);

    if (shouldSave && !customSession) {
      savePlayerLastLevelIndex(activePlayerId, safeIndex, trainingMode);
    }
  }

  function changeTrainingMode(mode: TrainingMode) {
    if (mode === trainingMode && !customSession) {
      return;
    }

    setCustomSession(null);
    setSessionLog([]);
    setTrainingMode(mode);
  }

  function startTraining(mode: "restart" | "continue") {
    setCustomSession(null);
    if (mode === "restart" || customSession) setSessionLog([]);
    moveToLevel(mode === "continue" ? savedLevelIndex : 0);
    setPlayerSelected(true);
    setHasEnteredGame(true);
  }

  function startWeakSpots() {
    const ids = levels.filter((item) => progress[item.id]?.needsRepeat).map((item) => item.id);

    if (ids.length === 0) {
      return;
    }

    setCustomSession({ kind: "weak", ids });
    setSessionLog([]);
    setPlayerSelected(true);
    setHasEnteredGame(true);
  }

  function startDayTraining() {
    setCustomSession({ kind: "day", ids: buildDayTrainingIds(progress, activePlayerId, todayIso()) });
    setSessionLog([]);
    setPlayerSelected(true);
    setHasEnteredGame(true);
  }

  function startMarathon() {
    setCustomSession({ kind: "marathon", ids: buildMarathonIds() });
    setSessionLog([]);
    setPlayerSelected(true);
    setHasEnteredGame(true);
  }

  function submitAnswer(reason: "manual" | "timeout" = "manual") {
    if (isReactionLevel && reactionPhase !== "active" && reason === "manual") {
      return;
    }

    const checked = checkAnswer(goalkeeper, level, activePitch, goalkeeperFacing, level.freeKick ? wall : undefined);
    const timedResult = reason === "timeout" ? resolveTimeoutResult(checked, goalkeeper, startGoalkeeperForLevel(level, levelIndex)) : checked;
    const finalResult = applyExitDecision(timedResult, level, exitChoice);
    const nextProgress = updateProgress(progress, level, finalResult);
    const earnedBadges = newlyEarnedBadges(computeBadges(progress, levels, penaltyBest), computeBadges(nextProgress, levels, penaltyBest));

    const example = finalResult.evaluation.openShotTarget ? shotExample(finalResult, level, goalkeeper, activePitch, level.freeKick ? wall : undefined) : null;
    setAnalysisRevealed(!example);
    setResult(finalResult);
    setWhyVisible(false);
    setReactionTimeLeft(null);
    setProgress(nextProgress);
    setSessionStreak((current) => (finalResult.result === "correct" ? current + 1 : 0));
    setSessionLog((current) => [
      ...current,
      { levelId: level.id, result: finalResult.result, score: finalResult.score, errorType: finalResult.errorType ?? finalResult.evaluation.mainErrorType }
    ]);

    // Удар в момент старта полета мяча, звук результата - когда мяч долетел.
    if (example) {
      playKick(0.38);
      playShotOutcome(example.isGoal, 1.05);
    } else {
      playResult(finalResult.result, 0.15);
    }

    if (earnedBadges.length > 0) {
      showBadgeToast(earnedBadges[0]);
    }
  }

  // Перенос прогресса между устройствами: все ключи игры из localStorage в файл и обратно.
  function exportProgress() {
    const entries: Record<string, string> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key?.startsWith("goalkeeper-sim:")) {
        entries[key] = localStorage.getItem(key) ?? "";
      }
    }

    const payload = JSON.stringify({ app: "goalkeeper-sim", version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `keeper-progress-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importProgress(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const entries = parseProgressExport(JSON.parse(String(reader.result)));

        if (!window.confirm("Загрузка заменит все данные игры на этом устройстве: игроков, прогресс, рекорды и настройки. Данные, которых нет в файле, будут удалены. Продолжить?")) {
          return;
        }
        replaceGameData(entries);
        window.location.reload();
      } catch {
        window.alert("Не удалось загрузить данные. Проверь файл и свободное место на устройстве.");
      }
    };
    reader.readAsText(file);
  }

  function showBadgeToast(badge: BadgeState) {
    if (badgeToastTimerRef.current !== null) {
      window.clearTimeout(badgeToastTimerRef.current);
    }

    setBadgeToast(badge);
    playBadge();
    badgeToastTimerRef.current = window.setTimeout(() => setBadgeToast(null), 4500);
  }

  function nextLevel() {
    // Спецсессии идут строго по порядку без возврата ошибок:
    // следующий неотвеченный сценарий, а когда все решены - итоги.
    if (customSession) {
      const answered = new Set(sessionLog.map((item) => item.levelId));
      const nextIndex = trainingLevels.findIndex((item) => !answered.has(item.id));

      if (nextIndex === -1) {
        finishSession();
        return;
      }

      moveToLevel(nextIndex);
      return;
    }

    if (levelIndex >= trainingLevels.length - 1) {
      finishSession();
      return;
    }
    moveToLevel(levelIndex + 1);
  }

  function finishSession() {
    // Серия дней и рекорд марафона засчитываются только за полностью
    // пройденную сессию, а не за досрочно открытые итоги.
    const answered = new Set(sessionLog.map((item) => item.levelId));
    const sessionComplete = customSession ? customSession.ids.every((id) => answered.has(id)) : false;

    if (customSession?.kind === "day" && sessionComplete) {
      setDayStreak(recordDayTraining(activePlayerId, todayIso()));
    }

    if (customSession?.kind === "marathon" && sessionComplete) {
      const score = marathonPoints(sessionLog);
      saveMarathonBest(activePlayerId, score);
      setMarathonBest(loadMarathonBest(activePlayerId));
    }

    setSummaryOpen(true);
  }

  function resetLevel(startLevel: Level = preparedLevel) {
    const startGoalkeeper = startGoalkeeperForLevel(startLevel, levelIndex);
    setGoalkeeper(startGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(startLevel, startGoalkeeper, levelIndex, activePitch));
    setWall(startWallForLevel(startLevel));
    setResult(null);
    setHintVisible(false);
    setWhyVisible(false);
    setReactionPhase(isReactionLevel ? "waiting" : "active");
    setReactionTimeLeft(null);
    setReactionPassDone(false);
    setExitChoice(null);
    setSimilarMessage(null);
  }

  function trySimilarLevel() {
    const nextLevel = mirrorLevel(preparedLevel);
    setMirroredLevelId(mirroredLevelId === rawLevel.id ? null : rawLevel.id);
    resetLevel(nextLevel);
    setSimilarMessage(Math.abs(preparedLevel.ball.x - nextLevel.ball.x) > 0.1
      ? "Та же идея, другая сторона"
      : "Та же идея: попробуй ещё раз");
  }

  function rotateGoalkeeper(delta: number) {
    setGoalkeeperFacing((current) => normalizeAngle(current + delta));
  }

  function handlePitchChange(nextPitch: PitchConfig) {
    setPitch(nextPitch);
    setResult(null);
    setWhyVisible(false);
  }

  function openSettings() {
    setDraftPitch(pitch);
    setDraftShowDimensions(showDimensions);
    setDraftReactionTimeSeconds(reactionTimeSeconds);
    setSettingsOpen(true);
  }

  function openStats() {
    setStatsPlayerId(activePlayerId);
    setStatsOpen(true);
  }

  function saveSettings() {
    if (pitchSettingsError(draftPitch)) return;
    handlePitchChange(draftPitch);
    setShowDimensions(draftShowDimensions);
    setReactionTimeSeconds(draftReactionTimeSeconds);
    setSettingsOpen(false);
  }

  function addPlayer() {
    const trimmedName = newPlayerName.trim();

    if (!trimmedName) {
      return;
    }

    const player = createPlayer(trimmedName);
    setPlayers((current) => [...current, player]);
    savePlayerProgress(player.id, {});
    savePlayerLastLevelIndex(player.id, 0, "base_position");
    savePlayerLastLevelIndex(player.id, 0, "reaction_to_ball_owner");
    setActivePlayerId(player.id);
    setNewPlayerName("");
  }

  function deleteActivePlayer() {
    const name = players.find((player) => player.id === activePlayerId)?.name ?? "игрока";
    const lastPlayerNote = players.length === 1 ? " Будет создан новый пустой профиль." : "";
    if (!window.confirm(`Удалить игрока «${name}» и все его результаты на этом устройстве? Это нельзя отменить.${lastPlayerNote}`)) {
      return;
    }

    const remaining = players.filter((player) => player.id !== activePlayerId);
    const nextPlayers = remaining.length ? remaining : [createPlayer("Игрок 1")];
    const nextPlayerId = nextPlayers[0].id;
    deletePlayerData(activePlayerId);
    setPlayers(nextPlayers);
    setActivePlayerId(nextPlayerId);
    setNewPlayerName("");
  }

  function openLevel(levelId: string) {
    const nextIndex = trainingLevels.findIndex((item) => item.id === levelId);

    if (nextIndex < 0) {
      return;
    }

    moveToLevel(nextIndex);
    setStatsOpen(false);
  }

  function trainStatsPlayer(playerId: string) {
    setActivePlayerId(playerId);
    setStatsPlayerId(playerId);
  }

  function clearStatsPlayerProgress(playerId: string) {
    const playerName = players.find((player) => player.id === playerId)?.name ?? "игрока";
    if (!window.confirm(`Очистить историю ответов и закрепление ситуаций игрока «${playerName}»? Рекорды, серия дней, место в программе и настройки сохранятся. Отменить очистку нельзя.`)) return;
    deletePlayerProgress(playerId);

    if (playerId === activePlayerId) {
      setProgress({});
    }

    setStatsRefreshKey((current) => current + 1);
    setStatsPlayerId(playerId);
  }

  function finishOnboarding() {
    setOnboardingComplete(true);
    saveOnboardingComplete(true);
  }

  function openOnboarding() {
    setOnboardingStep(0);
    setOnboardingComplete(false);
  }

  function nextOnboardingCard() {
    if (onboardingStep >= onboardingCards.length - 1) {
      finishOnboarding();
      return;
    }

    setOnboardingStep((current) => current + 1);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <div className="eyebrow">Тренажер вратаря</div>
          <h1>Где стоять?</h1>
        </div>
        <div className="top-stats" aria-label="Прогресс">
          <div>
            <span>{masteredCount(progress, trainingLevels)}</span>
            <small>закреплено</small>
          </div>
          <div>
            <span>{trainingLevels.length}</span>
            <small>ситуаций</small>
          </div>
          {marathonScore !== null ? (
            <div className="streak active" title="Очки марафона зависят от итоговой оценки каждой ситуации (до 100 за ситуацию).">
              <span>{marathonScore}</span>
              <small>очки марафона</small>
            </div>
          ) : (
            <div className={sessionStreak > 0 ? "streak active" : "streak"} title="Сколько ответов «Отлично» подряд. Ошибка обнуляет серию.">
              <span>{sessionStreak}</span>
              <small>верных подряд</small>
            </div>
          )}
        </div>
        <div className="top-actions">
          <button type="button" className="player-chip" title="Главное меню: смена игрока, блоки, серия пенальти" onClick={() => { setMenuStep("player"); setPlayerSelected(false); }}>
            <Home size={18} />
            <span>Меню · {activePlayer?.name ?? "Игрок"}</span>
          </button>
          <button
            type="button"
            className="icon-only"
            title={soundOn ? "Выключить звук" : "Включить звук"}
            aria-label={soundOn ? "Выключить звук" : "Включить звук"}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundOnState(next);
            }}
          >
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button type="button" title="Правила вратаря" aria-label="Правила вратаря" onClick={() => setRulesQuizOpen(true)}>
            <ListChecks size={18} />
            <span>Правила</span>
          </button>
          <button type="button" title="Обучение" aria-label="Обучение" onClick={openOnboarding}>
            <BookOpen size={18} />
            <span>Обучение</span>
          </button>
          <button type="button" title="Настройки" aria-label="Настройки" onClick={openSettings}>
            <Settings2 size={18} />
            <span>Настройки</span>
          </button>
          <button type="button" title="Статистика" aria-label="Статистика" onClick={openStats}>
            <BarChart3 size={18} />
            <span>Статистика</span>
          </button>
        </div>
      </header>

      <section className="workspace">
        <div className="field-area">
          <div className="level-strip">
            <div>
              <span className="badge">{categoryTitle(level.category)}</span>
              <h2>{level.title}</h2>
            </div>
            <div className={`result-summary ${visibleFieldLegend.length > 0 ? "with-legend" : ""}`}>
              <div className={`result-pill ${analysisRevealed ? resultClass(result) : ""}`}>{result && !analysisRevealed ? "Удар..." : resultLabel(result)}</div>
              {visibleFieldLegend.length > 0 && (
                <details className="result-legend-disclosure">
                  <summary>Обозначения на поле</summary>
                <div className="result-legend">
                  {visibleFieldLegend.map((item) => (
                    <div className="result-legend-row" key={`${item.kind}-${item.label}`}>
                      <span className={`legend-mark ${item.kind}`} aria-hidden="true" />
                      <span className="legend-label">{item.label}</span>
                      <span className="legend-separator">-</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
                </details>
              )}
            </div>
          </div>

          {isReactionLevel && !result && (
            <div className={`reaction-timer-banner ${reactionPhase}`} aria-live="polite">
              <strong>{reactionPhase === "waiting" ? "Мяч появится" : `Осталось ${reactionTimeLeft ?? effectiveReactionSeconds} сек.`}</strong>
              <span>{reactionPhase === "waiting" ? "Смотри расстановку игроков." : "Найди мяч, займи линию и остановись."}</span>
            </div>
          )}

          {similarMessage && !result && <p className="similar-message" role="status">{similarMessage}</p>}

          {playerSelected && onboardingComplete && contextualHint?.levelId === level.id && (
            <div className="contextual-hint" role="status">
              <Lightbulb size={20} aria-hidden="true" />
              <span>{contextualHintTexts[contextualHint.kind]}</span>
              <button type="button" className="contextual-hint-close" aria-label="Закрыть подсказку" onClick={() => setContextualHint(null)}>
                <X size={18} />
              </button>
            </div>
          )}

          <FieldView
            pitch={activePitch}
            level={displayedLevel}
            goalkeeper={goalkeeper}
            goalkeeperFacing={goalkeeperFacing}
            result={result}
            showDimensions={showDimensions}
            visualHints={shownFeedback?.visualHints ?? []}
            showOpenGoal={Boolean(shownFeedback)}
            alternativePlayerId={shownFeedback ? alternativePlayerId : null}
            hideBall={isReactionLevel && !reactionActive}
            wall={level.freeKick ? wall : undefined}
            onGoalkeeperChange={(point) => {
              if (!result) {
                setGoalkeeper(point);
              }
            }}
            onGoalkeeperFacingChange={(angle) => {
              if (!result) {
                setGoalkeeperFacing(angle);
              }
            }}
            onWallChange={(nextWall) => {
              if (!result) {
                setWall(nextWall);
              }
            }}
          />
        </div>

        <aside className="side">
          <section className="panel coach-panel">
            <div className="panel-title">
              <Shield size={18} />
              <span>Разбор позиции</span>
            </div>

            {isReactionLevel && !result && (
              <div className={`reaction-status ${reactionPhase}`}>
                <strong>{reactionPhase === "waiting" ? "Смотри расстановку" : `Мяч активен: ${reactionTimeLeft ?? effectiveReactionSeconds} сек.`}</strong>
                <span>{reactionPhase === "waiting" ? "Пока мяча нет, не угадывай позицию заранее." : "Найди игрока с мячом, займи линию и остановись."}</span>
              </div>
            )}

            <p className="coach-text">
              {result
                ? shownFeedback
                  ? shownFeedback.summary
                  : "Смотрим удар..."
                : customSession?.kind === "marathon"
                  ? `Марафон: 10 случайных ситуаций без подсказок. В зачёт идёт первая попытка. Сейчас у тебя ${marathonScore ?? 0} очков.`
                  : customSession?.kind === "weak" && repeatReason(progress[level.id]) === "reinforce"
                  ? "Уже получилось «Отлично»! Повтори ещё раз подряд, чтобы закрепить."
                  : customSession?.kind === "weak" && repeatReason(progress[level.id]) === "fix"
                  ? "Попробуй исправить прошлую попытку: посмотри на мяч и выбери позицию."
                  : isReactionLevel && reactionPhase === "waiting"
                  ? `${activePlayer?.name ?? "Игрок"}, сначала прочитай расстановку. Мяч появится через мгновение.`
                  : `${activePlayer?.name ?? "Игрок"}, выбери позицию до удара.`}
            </p>
            {!result && inferScenarioType(level, activePitch) === "one_v_one_loose_touch" && (
              <p className="session-summary-note">Мяч отпущен от ноги. Выбери стойку перед возможным ударом: скорость здесь не показана, поэтому нельзя определить, успеешь ли ты забрать мяч.</p>
            )}
            {!result && level.exitDecision && (
              <p className="session-summary-note">
                {level.exitDecision === "go"
                  ? "Условие упражнения: представь, что мяч летит в доступную зону, а путь к нему свободен. Скорость и высота на схеме не показаны."
                  : "Условие упражнения: представь, что мяч летит в скопление игроков и путь к нему перекрыт. Скорость и высота на схеме не показаны."}
              </p>
            )}
            {!result && level.category === "defender_pressure" && (
              <p className="session-summary-note">Посмотри, где защитник относительно мяча и ворот. На схеме не показано, успеет ли он помешать удару.</p>
            )}
            {shownFeedback && result?.evaluation.openShotTarget && shotExample(result, level, goalkeeper, activePitch, level.freeKick ? wall : undefined) && (
              <p className="session-summary-note">Это пример удара по условной схеме, а не прогноз. Оценка позиции показана отдельно.</p>
            )}
            {shownFeedback && alternativeAttackers.length > 0 && ["one_v_one", "pass_reposition", "defender_pressure"].includes(level.category) && (
              <div className="alternative-pass">
                <p>Если последует пас, угол удара изменится. Посмотри линии от другого нападающего и будь готов перестроиться.</p>
                {alternativeAttackers.map((player, index) => (
                  <button key={player.id} type="button" aria-pressed={alternativePlayerId === player.id} onClick={() => setAlternativePlayerId(alternativePlayerId === player.id ? null : player.id)}>
                    {alternativePlayerId === player.id ? "Скрыть линии" : `Линии от игрока ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
            {result && analysisRevealed && level.exitDecision && exitChoice && exitChoice !== level.exitDecision && (
              <p className="decision-note">
                {level.exitDecision === "go"
                  ? "По условию мяч доступен и путь свободен: в этом упражнении выбираем «Выйду на мяч». В игре это не прогноз исхода."
                  : "По условию путь к мячу перекрыт игроками: в этом упражнении выбираем «Останусь в воротах»."}
              </p>
            )}
            {shownFeedback && result && result.evaluation.openGoalPercent !== undefined && (
              <div className="open-goal-row" aria-label="Открытая часть ворот">
                <span>
                  Нападающему примерно открыто <strong>{result.evaluation.openGoalPercent}%</strong> ворот
                </span>
                <span>Открытая часть отмечена оранжевым на линии ворот. Это схема по земле, высота удара не учитывается.</span>
                {result.evaluation.optimalOpenGoalPercent !== undefined && result.evaluation.optimalOpenGoalPercent < (result.evaluation.openGoalPercent ?? 0) && (
                  <span className="open-goal-best">
                    из лучшей точки - {result.evaluation.optimalOpenGoalPercent}%
                  </span>
                )}
              </div>
            )}
            {shownFeedback && result && level.freeKick && (
              <div className="open-goal-row" aria-label="Открытая часть ворот при штрафном">
                <span>Оранжевым показана примерная открытая часть ворот по земле. Высота удара не учитывается, фигуры увеличены для наглядности.</span>
              </div>
            )}
            {shownFeedback && result?.evaluation.notes.includes("Стенка слишком близко к мячу.") && (
              <p className="decision-note">Стенка слишком близко к мячу. Отодвинь её на нужное расстояние.</p>
            )}
            {shownFeedback && result && (
              <>
                <div className="why-toggle-row">
                  <button className={`why-toggle ${whyVisible ? "active" : ""}`} type="button" onClick={() => setWhyVisible((current) => !current)}>
                    <Eye size={16} />
                    <span>{whyVisible ? "Скрыть объяснение" : "Почему так и что покажет поле"}</span>
                  </button>
                </div>
                {whyVisible && (
                  <div className="why-card">
                    <strong>Почему так</strong>
                    <span>{shownFeedback.details?.why}</span>
                    <span>{shownFeedback.details?.howToFix}</span>
                  </div>
                )}
                <div className="criteria-list" aria-label="Разбор решения">
                  {shownFeedback.criteria.map((criterion) => (
                    <div className="criterion-row" key={criterion.key}>
                      <span className={`criterion-status ${criterion.status}`}>{criterionStatusText(criterion.status)}</span>
                      <div>
                        <strong>{criterion.label}</strong>
                        <small>{criterion.text}</small>
                      </div>
                    </div>
                  ))}
                </div>
                {whyVisible && criteriaLegendItems(shownFeedback.criteria).length > 0 && (
                  <div className="zone-legend" aria-label="Обозначения зон">
                    {criteriaLegendItems(shownFeedback.criteria).map((item) => (
                      <span key={item.kind}>
                        <i className={`legend-dot ${item.kind}`} />
                        {item.text}
                      </span>
                    ))}
                  </div>
                )}
                <div className="how-card">
                  <strong>{result.result === "correct" ? "Как закрепить" : "Как поправить"}</strong>
                  <span>{shownFeedback.mainAdvice}</span>
                </div>
                {result.result !== "correct" && (
                  <div className="correction-actions">
                    <button type="button" onClick={() => resetLevel()}><RotateCcw size={18} />Поправить</button>
                    <button type="button" onClick={trySimilarLevel}><RotateCw size={18} />Похожая ситуация</button>
                  </div>
                )}
              </>
            )}

            {level.freeKick && (
              <div className="wall-control">
                <div>
                  <strong>Стенка</strong>
                  <span>{result ? `Нужно: ${level.freeKick.recommendedWallCount}` : "Выбери число и поставь стенку"}</span>
                </div>
                <div className="stepper" aria-label="Количество игроков в стенке">
                  <button
                    type="button"
                    onClick={() => setWall((current) => ({ ...current, count: Math.max(0, current.count - 1) }))}
                    disabled={Boolean(result) || wall.count <= 0}
                    aria-label="Убрать игрока из стенки"
                  >
                    -
                  </button>
                  <b>{wall.count}</b>
                  <button
                    type="button"
                    onClick={() => setWall((current) => ({ ...current, count: Math.min(5, current.count + 1) }))}
                    disabled={Boolean(result) || wall.count >= 5}
                    aria-label="Добавить игрока в стенку"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {!result && level.exitDecision && (
              <div className="exit-decision" aria-label="Решение на подаче">
                <span>Твое решение:</span>
                <div className="exit-decision-buttons">
                  <button type="button" className={exitChoice === "go" ? "active" : ""} onClick={() => setExitChoice("go")}>
                    Выйду на мяч
                  </button>
                  <button type="button" className={exitChoice === "stay" ? "active" : ""} onClick={() => setExitChoice("stay")}>
                    Останусь в воротах
                  </button>
                </div>
              </div>
            )}

            {!result && (
              <div className="turn-control">
                <span>Корпус</span>
                <div className="turn-buttons" aria-label="Поворот корпуса">
                  <button type="button" onClick={() => rotateGoalkeeper(-15)} aria-label="Повернуть корпус влево">
                    <RotateCcw size={18} />
                  </button>
                  <button type="button" onClick={() => rotateGoalkeeper(15)} aria-label="Повернуть корпус вправо">
                    <RotateCw size={18} />
                  </button>
                </div>
              </div>
            )}

            {hintVisible && !result && <p className="hint-text">{level.hintText}</p>}

            <div className="actions">
              {!result ? (
                <button className="primary" type="button" onClick={() => submitAnswer()} disabled={(isReactionLevel && reactionPhase !== "active") || Boolean(level.exitDecision && !exitChoice)}>
                  <Target size={18} />
                  <span>{level.exitDecision && !exitChoice ? "Сначала выбери решение" : "Готов"}</span>
                </button>
              ) : (
                <button className="primary" type="button" onClick={nextLevel}>
                  <ChevronRight size={18} />
                  <span>Дальше</span>
                </button>
              )}

              {!result ? (
                customSession?.kind !== "marathon" && (
                  <button type="button" onClick={() => setHintVisible(true)}>
                    <Lightbulb size={18} />
                    <span>Подсказка</span>
                  </button>
                )
              ) : (
                <button type="button" onClick={() => setWhyVisible((current) => !current)}>
                  <Eye size={18} />
                  <span>{whyVisible ? "Скрыть объяснение" : "Почему так"}</span>
                </button>
              )}

              <button type="button" onClick={() => resetLevel()}>
                <RotateCcw size={18} />
                <span>Повтор</span>
              </button>
            </div>
          </section>

          <section className="panel summary-panel">
            <div className="panel-title">
              <Activity size={18} />
              <span>Тренировка</span>
            </div>
            <div className="mode-switch" aria-label="Блок тренировки">
              <button className={trainingMode === "base_position" && !customSession ? "active" : ""} type="button" onClick={() => changeTrainingMode("base_position")}>
                База
              </button>
              <button className={trainingMode === "reaction_to_ball_owner" && !customSession ? "active" : ""} type="button" onClick={() => changeTrainingMode("reaction_to_ball_owner")}>
                Реакция
              </button>
            </div>
            <p className="summary-line">
              {customSessionTitle(customSession?.kind) ?? trainingModeTitle(trainingMode)} · {levelIndex + 1}/{trainingLevels.length}
              {trainingMode === "reaction_to_ball_owner" ? ` · ${reactionTimeSeconds} сек.` : ""} · {activePitch.name}
            </p>
            <button type="button" className="ghost" onClick={() => setShowDimensions(!showDimensions)}>
              <Eye size={17} />
              <span>{showDimensions ? "Скрыть размеры" : "Показать размеры"}</span>
            </button>
            {sessionLog.length > 0 && (
              <button type="button" className="ghost" onClick={finishSession}>
                <BarChart3 size={17} />
                <span>Итоги тренировки</span>
              </button>
            )}
          </section>
        </aside>
      </section>

      <div className={`mobile-action-bar ${result ? "after-result" : ""}`} aria-label="Действия тренировки">
        {!result ? (
          <button className="primary" type="button" onClick={() => submitAnswer()} disabled={(isReactionLevel && reactionPhase !== "active") || Boolean(level.exitDecision && !exitChoice)}>
            <Target size={18} />
            <span>{level.exitDecision && !exitChoice ? "Сначала выбери решение" : "Готов"}</span>
          </button>
        ) : (
          <button className="primary" type="button" onClick={nextLevel}>
            <ChevronRight size={18} />
            <span>Дальше</span>
          </button>
        )}

        {!result && customSession?.kind !== "marathon" && (
          <button className="secondary" type="button" aria-label="Подсказка" onClick={() => setHintVisible(true)}>
            <Lightbulb size={18} />
            <span>Подсказка</span>
          </button>
        )}

        <button className="secondary" type="button" aria-label="Повтор" onClick={() => resetLevel()}>
          <RotateCcw size={18} />
          <span>Повтор</span>
        </button>
      </div>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Настройки">
            <div className="modal-header">
              <div>
                <div className="eyebrow">Параметры тренировки</div>
                <h2>Настройки</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Закрыть настройки" onClick={() => setSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-grid">
              <PlayerPanel
                players={players}
                activePlayerId={activePlayerId}
                newPlayerName={newPlayerName}
                onActivePlayerChange={setActivePlayerId}
                onNewPlayerNameChange={setNewPlayerName}
                onAddPlayer={addPlayer}
                onDeletePlayer={deleteActivePlayer}
              />
              <SettingsPanel
                pitch={draftPitch}
                showDimensions={draftShowDimensions}
                reactionTimeSeconds={draftReactionTimeSeconds}
                onPitchChange={setDraftPitch}
                onShowDimensionsChange={setDraftShowDimensions}
                onReactionTimeSecondsChange={setDraftReactionTimeSeconds}
              />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
                <span>Отмена</span>
              </button>
              <button className="primary" type="button" onClick={saveSettings} disabled={Boolean(pitchSettingsError(draftPitch))}>
                <Save size={18} />
                <span>Сохранить</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {!playerSelected && (
        <div className="modal-backdrop start-backdrop" role="presentation">
          <section className="modal start-modal" role="dialog" aria-modal="true" aria-label="Главное меню">
            <div className="modal-header">
              <div>
                <div className="eyebrow">Где стоять вратарю?</div>
                <h2>{menuStep === "player" ? "Кто сегодня тренируется?" : menuStep === "pitch" ? "Выбери формат игры" : menuStep === "training" ? "Выбери тренировку" : "Данные и установка"}</h2>
              </div>
              <div className="menu-header-actions">
              {menuStep !== "player" && <button className="icon-button menu-home" type="button" aria-label="На экран выбора игрока" title="На экран выбора игрока" onClick={() => setMenuStep("player")}><Home size={19} /></button>}
              {hasEnteredGame && <button className="icon-button" type="button" aria-label="Вернуться к тренировке" title="Вернуться к тренировке" onClick={() => setPlayerSelected(true)}>
                <X size={20} />
              </button>}
              </div>
            </div>
            <div className="start-body">
              {menuStep !== "data" && <div className="menu-progress" aria-label={`Шаг ${menuStep === "player" ? 1 : menuStep === "pitch" ? 2 : 3} из 3`}><span className={menuStep === "player" ? "active" : ""}>1 Игрок</span><span className={menuStep === "pitch" ? "active" : ""}>2 Формат</span><span className={menuStep === "training" ? "active" : ""}>3 Тренировка</span></div>}
              {menuStep === "player" && <>
                <div className="menu-welcome"><span className="menu-welcome-icon"><Shield size={27} /></span><div><span>{firstVisit ? "Привет, вратарь!" : "С возвращением!"}</span><strong>{activePlayer?.name ?? "Игрок"}</strong><small>Звание: {keeperRank(masteredAllCount)} · закреплено {masteredAllCount} из {levels.length}</small></div></div>
                <label className="menu-label">Выбрать игрока
                  <select value={activePlayerId} onChange={(event) => setActivePlayerId(event.target.value)}>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
                </label>
                <button className="menu-delete-player" type="button" onClick={deleteActivePlayer}>Удалить выбранного игрока</button>
                <div className="menu-add-player"><label className="menu-label" htmlFor="menu-new-player">Новый игрок</label><div className="add-player-row"><input id="menu-new-player" value={newPlayerName} type="text" placeholder="Имя игрока" maxLength={24} onChange={(event) => setNewPlayerName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addPlayer(); }} /><button type="button" onClick={addPlayer} disabled={!newPlayerName.trim()}>Добавить</button></div><small>Новый игрок получит свой прогресс.</small></div>
                <button className="primary menu-next" type="button" onClick={() => setMenuStep("pitch")}>Это я <ChevronRight size={18} /></button>
              </>}

              {menuStep === "pitch" && <>
                <p className="menu-intro">Для формата автоматически подберём размер ворот.</p>
                <div className="menu-formats" aria-label="Формат игры">
                  {(["5v5", "7v7", "8v8", "9v9", "11v11"] as const).map((id) => <button key={id} type="button" className={pitch.presetId === id ? "active" : ""} aria-pressed={pitch.presetId === id} onClick={() => handlePitchChange(pitchPresets[id])}>{id.replace("v", " × ")}</button>)}
                </div>
                <div className="menu-goal"><span>Размер ворот</span><strong>{pitch.goalWidth.toLocaleString("ru-RU")} × {pitch.goalHeight.toLocaleString("ru-RU")} м</strong><small>{pitch.presetId === "custom" || pitch.goalWidth !== pitchPresets[pitch.presetId].goalWidth || pitch.goalHeight !== pitchPresets[pitch.presetId].goalHeight ? "Сохранены свои размеры. Изменить их можно в настройках." : "Подобран для выбранного формата"}</small></div>
                {(pitch.presetId === "7v7" || pitch.presetId === "8v8") && <p className="menu-intro">Малая вратарская площадь показана приблизительно: её размер зависит от правил соревнования.</p>}
                <div className="menu-navigation"><button type="button" onClick={() => setMenuStep("player")}>Назад</button><button className="primary" type="button" onClick={() => setMenuStep("training")}>Дальше <ChevronRight size={18} /></button></div>
              </>}

              {menuStep === "training" && <>
              <div className="menu-selection">{activePlayer?.name} <span>·</span> {pitch.name} <span>·</span> ворота {pitch.goalWidth.toLocaleString("ru-RU")} × {pitch.goalHeight.toLocaleString("ru-RU")} м</div>
              <div className="start-section">
                <div className="start-section-label">Программа тренировки</div>
                <div className="start-mode-choice" aria-label="Выбор блока тренировки">
                  <button className={trainingMode === "base_position" ? "active" : ""} type="button" onClick={() => changeTrainingMode("base_position")}>
                    <strong>База</strong>
                    <span>{baseLevelCount} сценариев</span>
                  </button>
                  <button className={trainingMode === "reaction_to_ball_owner" ? "active" : ""} type="button" onClick={() => changeTrainingMode("reaction_to_ball_owner")}>
                    <strong>Реакция</strong>
                    <span>{reactionLevelCount} сценариев</span>
                  </button>
                </div>
                <p className="session-hint">
                  {hasTrainingToContinue
                    ? `Можно продолжить блок «${trainingModeTitle(trainingMode)}» с задания ${savedLevelIndex + 1} из ${trainingLevels.length}.`
                    : `В блоке «${trainingModeTitle(trainingMode)}» пока нет начатой тренировки.`}
                </p>
                <div className="start-primary-row">
                  <button className="primary" type="button" onClick={() => startTraining("continue")}>
                    <Play size={18} />
                    <span>Продолжить</span>
                  </button>
                  <button type="button" onClick={() => startTraining("restart")}>
                    <RotateCcw size={18} />
                    <span>Начать заново</span>
                  </button>
                </div>
              </div>

              <div className="start-section">
                <div className="start-section-label">Режимы и мини-игры</div>
                <div className="mode-grid">
                  <button type="button" className="day-training-button" onClick={startDayTraining}>
                    <Play size={18} />
                    <span>Тренировка дня{dayStreak && dayStreak.streak > 0 ? ` · ${dayStreak.streak} дн.` : ""}</span>
                  </button>
                  <button type="button" onClick={startMarathon}>
                    <Activity size={18} />
                    <span>Марафон{marathonBest !== null ? ` · ${marathonBest}` : ""}</span>
                  </button>
                  <button type="button" onClick={startWeakSpots} disabled={weakSpotsCount === 0} title={weakSpotsCount === 0 ? "Пока нет сценариев на повтор" : undefined}>
                    <Target size={18} />
                    <span>Повтор ситуаций{weakSpotsCount > 0 ? ` (${weakSpotsCount})` : ""}</span>
                  </button>
                  <button type="button" onClick={() => setShootoutOpen(true)}>
                    <Award size={18} />
                    <span>Серия пенальти{penaltyBest !== null ? ` · ${penaltyBest}/5` : ""}</span>
                  </button>
                </div>
                {players.length > 1 && (
                  <p className="records-line">
                    Рекорды марафона: {players.map((player) => `${player.name} - ${loadMarathonBest(player.id) ?? "нет"}`).join(" · ")}
                  </p>
                )}
              </div>

              <div className="menu-back-links"><button className="menu-back" type="button" onClick={() => setMenuStep("pitch")}>← Формат</button><button className="menu-back" type="button" onClick={() => setMenuStep("player")}>К выбору игрока</button></div>
              </>}

              {menuStep === "data" && <div className="start-extra menu-data">
                <div className="data-transfer" aria-label="Перенос прогресса">
                  <button type="button" className="ghost" onClick={exportProgress}>
                    <Save size={16} />
                    <span>Прогресс в файл</span>
                  </button>
                  <button type="button" className="ghost" onClick={() => importInputRef.current?.click()}>
                    <RotateCw size={16} />
                    <span>Загрузить из файла</span>
                  </button>
                  <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importProgress} />
                </div>
                {(installPromptEvent || isIosBrowser) && (
                  <div className="install-banner">
                    <span>
                      {installPromptEvent
                        ? "Игру можно установить на главный экран - она откроется как обычное приложение."
                        : "На iPhone/iPad: нажми «Поделиться», затем «На экран Домой» - игра станет приложением."}
                    </span>
                    {installPromptEvent && (
                      <div className="install-banner-actions">
                        <button type="button" className="primary" onClick={() => void installPromptEvent.prompt()}>
                          Установить
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <button type="button" onClick={() => setMenuStep(dataReturnStep)}>Назад</button>
              </div>}
              {menuStep === "player" && <button type="button" className="menu-data-link" onClick={() => { setDataReturnStep("player"); setMenuStep("data"); }}>Данные и установка</button>}
            </div>
          </section>
        </div>
      )}

      {playerSelected && !onboardingComplete && (
        <div className="modal-backdrop onboarding-backdrop" role="presentation">
          <section className="modal onboarding-modal" role="dialog" aria-modal="true" aria-label="Обучение">
            <div className="modal-header">
              <div>
                <div className="eyebrow">Справка</div>
                <h2>Обучение</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Пропустить обучение" onClick={finishOnboarding}>
                <X size={20} />
              </button>
            </div>

            <div className="onboarding-card">
              <div className="onboarding-progress">
                {onboardingCards.map((card, index) => (
                  <span key={card.title} className={index === onboardingStep ? "active" : ""} />
                ))}
              </div>
              <strong>{onboardingCards[onboardingStep].title}</strong>
              <OnboardingVisual visual={onboardingCards[onboardingStep].visual} />
              <p>{onboardingCards[onboardingStep].text}</p>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={finishOnboarding}>
                <span>Пропустить</span>
              </button>
              <button
                type="button"
                onClick={() => setOnboardingStep((current) => Math.max(0, current - 1))}
                disabled={onboardingStep === 0}
              >
                <span>Назад</span>
              </button>
              <button className="primary" type="button" onClick={nextOnboardingCard}>
                <span>{onboardingStep === onboardingCards.length - 1 ? "Начать" : "Дальше"}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {statsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal stats-modal" role="dialog" aria-modal="true" aria-label="Статистика">
            <div className="modal-header">
              <div>
                <div className="eyebrow">{statsPlayer?.name ?? "Игрок"}</div>
                <h2>Статистика</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Закрыть статистику" onClick={() => setStatsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <StatsPanel
              levels={trainingLevels}
              players={players}
              activePlayerId={activePlayerId}
              selectedPlayerId={statsPlayer?.id ?? activePlayerId}
              progressByPlayer={statsProgressByPlayer}
              onSelectedPlayerChange={setStatsPlayerId}
              onTrainPlayer={trainStatsPlayer}
              onOpenLevel={openLevel}
              onClearPlayerProgress={clearStatsPlayerProgress}
            />
          </section>
        </div>
      )}

      {rulesQuizOpen && <RulesQuiz onClose={() => setRulesQuizOpen(false)} />}

      {shootoutOpen && (
        <PenaltyShootout
          bestScore={penaltyBest}
          onFinish={(saves) => {
            const badgesBefore = computeBadges(progress, levels, penaltyBest);
            savePenaltyBest(activePlayerId, saves);
            const nextBest = loadPenaltyBest(activePlayerId);
            setPenaltyBest(nextBest);
            const earnedBadges = newlyEarnedBadges(badgesBefore, computeBadges(progress, levels, nextBest));

            if (earnedBadges.length > 0) {
              showBadgeToast(earnedBadges[0]);
            }
          }}
          onClose={() => setShootoutOpen(false)}
        />
      )}

      {summaryOpen &&
        (() => {
          const total = sessionLog.length;
          const uniqueSituations = firstAttempts(sessionLog).length;
          const allAttempts = Object.values(progress).reduce((sum, item) => sum + item.attempts, 0);
          const excellent = sessionLog.filter((item) => item.result === "correct").length;
          const errorCounts = new Map<ErrorType, number>();

          sessionLog.forEach((item) => {
            if (item.result !== "correct" && item.errorType) {
              errorCounts.set(item.errorType, (errorCounts.get(item.errorType) ?? 0) + 1);
            }
          });

          const topError = [...errorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
          const marathonScore = marathonPoints(sessionLog);
          const kind = customSession?.kind;

          const closeToMenu = () => {
            setSummaryOpen(false);
            setCustomSession(null);
            setSessionLog([]);
            setPlayerSelected(false);
          };

          return (
            <div className="modal-backdrop" role="presentation">
              <section className="modal summary-modal" role="dialog" aria-modal="true" aria-label="Итоги тренировки">
                <div className="modal-header">
                  <div>
                    <div className="eyebrow">{customSessionTitle(kind) ?? "Тренировка"}</div>
                    <h2>Итоги тренировки</h2>
                  </div>
                  <button className="icon-button" type="button" aria-label="Закрыть итоги" onClick={() => setSummaryOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="session-summary">
                  <div className="summary-row">
                    <span>Ситуаций в этой тренировке</span>
                    <strong>{uniqueSituations}</strong>
                  </div>
                  <div className="summary-row"><span>Попыток в этой тренировке</span><strong>{total}</strong></div>
                  <div className="summary-row"><span>Всего попыток игрока</span><strong>{allAttempts}</strong></div>
                  <div className="summary-row">
                      <span>Попыток на «Отлично»</span>
                    <strong>
                      {excellent} из {total}
                    </strong>
                  </div>
                  {kind === "marathon" && (
                    <div className="summary-row">
                      <span>Очки марафона</span>
                      <strong>
                        {marathonScore}
                        {marathonBest !== null ? ` (рекорд ${marathonBest})` : ""}
                      </strong>
                    </div>
                  )}
                  {kind === "marathon" && (
                      <p className="session-summary-note">В зачёт идёт первая попытка каждой ситуации. Повторы учитываются в статистике, но не меняют очки. Максимум — 1000 очков.</p>
                  )}
                  {kind === "day" && dayStreak && (
                    <div className="summary-row">
                      <span>Дней подряд</span>
                      <strong>
                        {dayStreak.streak}
                        {dayStreak.best > dayStreak.streak ? ` (лучшая серия ${dayStreak.best})` : ""}
                      </strong>
                    </div>
                  )}
                  {topError && (
                    <div className="summary-row">
                      <span>{topError[1] > 1 ? "Частая ошибка" : "На что обратить внимание"}</span>
                      <strong>{errorLabel(topError[0]).replace(/^часто /, "")}</strong>
                    </div>
                  )}
                  <p className="session-summary-note">
                    {excellent === total && total > 0
                      ? "Идеальная тренировка - так держать!"
                      : topError
                        ? "Ситуации можно повторить в режиме «Повтор ситуаций»."
                        : "Хорошая работа. Продолжай в том же духе."}
                  </p>
                </div>
                <div className="modal-actions">
                  {weakSpotsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSummaryOpen(false);
                        startWeakSpots();
                      }}
                    >
                      <Target size={18} />
                      <span>Повтор ситуаций</span>
                    </button>
                  )}
                  <button className="primary" type="button" onClick={closeToMenu}>
                    <Home size={18} />
                    <span>В меню</span>
                  </button>
                </div>
              </section>
            </div>
          );
        })()}

      {badgeToast && (
        <div className="badge-toast" role="status">
          <Award size={22} />
          <div>
            <strong>Новый бейдж: {badgeToast.title}</strong>
            <small>{badgeToast.description}</small>
          </div>
        </div>
      )}
    </main>
  );
}
