import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, BookOpen, ChevronRight, Eye, Lightbulb, Play, RotateCcw, RotateCw, Save, Settings2, Shield, Target, X } from "lucide-react";
import { FieldView } from "./components/FieldView";
import { PlayerPanel } from "./components/PlayerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsPanel } from "./components/StatsPanel";
import { checkAnswer } from "./domain/evaluate";
import { buildFeedback, criterionStatusText } from "./domain/feedback";
import { facingAngleToBall, normalizeAngle } from "./domain/geometry";
import { levels } from "./domain/levels";
import { pitchPresets } from "./domain/presets";
import { criteriaByScenarioType, getBallSide, type CriterionKey } from "./domain/scenarios";
import type { CheckResult, ErrorType, Level, PitchConfig, PlayerProfile, Point, Progress, WallConfig } from "./domain/types";
import {
  loadActivePlayerId,
  loadOnboardingComplete,
  loadPitch,
  loadPlayerLastLevelIndex,
  loadPlayerProgress,
  loadPlayers,
  loadShowDimensions,
  deletePlayerLastLevelIndex,
  deletePlayerProgress,
  saveActivePlayerId,
  saveOnboardingComplete,
  savePitch,
  savePlayerLastLevelIndex,
  savePlayerProgress,
  savePlayers,
  saveShowDimensions
} from "./storage";

const onboardingCards = [
  {
    title: "Начало задания",
    visual: "position",
    text: "Перетащи вратаря в правильную позицию перед ударом."
  },
  {
    title: "Корпус к мячу",
    visual: "body",
    text: "Маленькая стрелка на вратаре показывает, куда развернут корпус. Её можно потянуть на поле или повернуть корпус кнопками в панели."
  },
  {
    title: "Зоны после ответа",
    visual: "zones",
    text: "После проверки появляются зоны как на поле: зелёная - правильная позиция, жёлтая - почти, красная - опасно. Важна белая точка у ног вратаря."
  },
  {
    title: "Разбор после ответа",
    visual: "feedback",
    text: "После проверки смотри чеклист. Если нажать «Показать почему», на поле появятся красные зоны: слишком близко к воротам и слишком далеко от ворот."
  },
  {
    title: "Стенка при штрафном",
    visual: "wall",
    text: "В штрафных выбери число игроков и перетащи стенку в подсвеченную зону. Стенка закрывает часть ворот, а вратарь должен видеть мяч."
  },
  {
    title: "Игроки и статистика",
    visual: "stats",
    text: "Можно добавить нескольких детей без регистрации. В статистике выбирай игрока и смотри его ошибки, слабые темы и задания для повтора."
  },
  {
    title: "Поле и ворота",
    visual: "settings",
    text: "В настройках можно менять формат игры, размеры поля и ворот. Это полезно, если матчи проходят на разных площадках."
  }
];

function LessonBall({ x, y, r = 3.3 }: { x: number; y: number; r?: number }) {
  return (
    <g className="lesson-ball" transform={`translate(${x} ${y})`}>
      <circle className="lesson-ball-shadow" cx="0.25" cy="0.55" r={r} />
      <circle className="lesson-ball-base" cx="0" cy="0" r={r} />
      <path className="lesson-ball-patch" d={`M 0 ${-r * 0.62} L ${r * 0.56} ${-r * 0.16} L ${r * 0.34} ${r * 0.54} L ${-r * 0.34} ${r * 0.54} L ${-r * 0.56} ${-r * 0.16} Z`} />
      <path className="lesson-ball-stitch" d={`M 0 ${-r * 0.62} L 0 ${-r * 0.98} M ${r * 0.56} ${-r * 0.16} L ${r * 0.96} ${-r * 0.34} M ${r * 0.34} ${r * 0.54} L ${r * 0.62} ${r * 0.9} M ${-r * 0.34} ${r * 0.54} L ${-r * 0.62} ${r * 0.9} M ${-r * 0.56} ${-r * 0.16} L ${-r * 0.96} ${-r * 0.34}`} />
    </g>
  );
}

function LessonAttacker({ x, y, scale = 1.7 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="figure attacker-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      <g transform="translate(0 -3.85)">
        <ellipse className="figure-shadow" cx="0" cy="3.8" rx="1.75" ry="0.55" />
        <circle className="figure-head" cx="0" cy="-3.1" r="0.72" />
        <path className="figure-hair" d="M -0.65 -3.25 Q 0 -4.05 0.72 -3.25 Q 0.18 -3.55 -0.65 -3.25" />
        <path className="figure-shirt" d="M -1.35 -2.15 L 1.35 -2.15 L 1.65 0.75 Q 0 1.35 -1.65 0.75 Z" />
        <path className="figure-sleeve" d="M -1.35 -1.95 L -2.25 -0.55" />
        <path className="figure-sleeve" d="M 1.35 -1.95 L 2.25 -0.55" />
        <path className="figure-shorts" d="M -1.2 0.95 L 1.2 0.95 L 0.82 2.05 L -0.82 2.05 Z" />
        <path className="figure-sock" d="M -0.62 2 L -1.05 3.8" />
        <path className="figure-sock" d="M 0.62 2 L 1.05 3.8" />
      </g>
    </g>
  );
}

function LessonGoalkeeper({ x, y, facing = 32, scale = 1.7 }: { x: number; y: number; facing?: number; scale?: number }) {
  return (
    <g className="goalkeeper-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      <g transform="translate(0 -3.85)">
        <ellipse className="figure-shadow" cx="0" cy="3.9" rx="1.9" ry="0.55" />
        <g className="keeper-direction" transform={`translate(0 1.4) rotate(${facing}) translate(0 -1.4)`}>
          <path className="keeper-facing-cone" d="M 0 -5.2 L -1.35 -2.2 L 1.35 -2.2 Z" />
          <path className="keeper-facing-mark" d="M 0 -5.1 L -0.72 -4.05 L 0.72 -4.05 Z" />
        </g>
        <circle className="figure-head" cx="0" cy="-3.25" r="0.78" />
        <path className="figure-hair" d="M -0.7 -3.3 Q 0 -4.08 0.76 -3.3 Q 0.2 -3.6 -0.7 -3.3" />
        <path className="keeper-shirt" d="M -1.45 -2.2 L 1.45 -2.2 L 1.72 0.8 Q 0 1.42 -1.72 0.8 Z" />
        <path className="keeper-arm" d="M -1.42 -1.85 L -2.65 -0.2" />
        <path className="keeper-arm" d="M 1.42 -1.85 L 2.65 -0.2" />
        <path className="keeper-shorts" d="M -1.18 0.95 L 1.18 0.95 L 0.8 2.1 L -0.8 2.1 Z" />
        <path className="keeper-leg" d="M -0.58 2 L -1.1 3.85" />
        <path className="keeper-leg" d="M 0.58 2 L 1.1 3.85" />
        <circle className="keeper-glove" cx="-2.75" cy="-0.05" r="0.42" />
        <circle className="keeper-glove" cx="2.75" cy="-0.05" r="0.42" />
      </g>
    </g>
  );
}

function LessonWall({ x, y, count = 3, scale = 1.45 }: { x: number; y: number; count?: number; scale?: number }) {
  const spacing = 1.65;
  const start = -((count - 1) * spacing) / 2;

  return (
    <g className="wall-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      {Array.from({ length: count }).map((_, index) => {
        const playerX = start + index * spacing;

        return (
          <g key={index} className="wall-player" transform={`translate(${playerX} 0)`}>
            <ellipse className="figure-shadow" cx="0" cy="1.5" rx="1" ry="0.32" />
            <circle className="figure-head" cx="0" cy="-2.65" r="0.56" />
            <path className="wall-shirt" d="M -0.95 -1.9 L 0.95 -1.9 L 1.12 0.2 Q 0 0.72 -1.12 0.2 Z" />
            <path className="wall-arm" d="M -0.9 -1.45 L -1.45 -0.15" />
            <path className="wall-arm" d="M 0.9 -1.45 L 1.45 -0.15" />
            <path className="wall-leg" d="M -0.35 0.45 L -0.65 1.55" />
            <path className="wall-leg" d="M 0.35 0.45 L 0.65 1.55" />
          </g>
        );
      })}
    </g>
  );
}

function OnboardingVisual({ visual }: { visual: string }) {
  switch (visual) {
    case "position":
      return (
        <div className="lesson-visual lesson-position" aria-hidden="true">
          <svg className="lesson-field-svg" viewBox="0 0 160 92">
            <rect className="lesson-grass" x="0" y="0" width="160" height="92" />
            <rect className="lesson-stripe" x="0" y="18" width="160" height="18" />
            <rect className="lesson-stripe" x="0" y="54" width="160" height="18" />
            <path className="line" d="M 44 62 L 116 62 L 116 92 L 44 92 Z" />
            <path className="goal-mouth" d="M 61 80 L 99 80 L 96 92 L 64 92 Z" />
            <path className="goal-net" d="M 63 81 L 97 81 L 95 91 L 65 91 Z" />
            <line className="goal-line-strong" x1="58" y1="80" x2="102" y2="80" />
            <line className="goal-front-frame" x1="61" y1="80" x2="99" y2="80" />
            <line className="goal-post" x1="61" y1="80" x2="64" y2="92" />
            <line className="goal-post" x1="99" y1="80" x2="96" y2="92" />
            <LessonGoalkeeper x={80} y={76} facing={-28} scale={1.55} />
            <circle className="keeper-foot-point" cx="80" cy="76" r="1.2" />
            <LessonAttacker x={46} y={27} scale={1.7} />
            <LessonBall x={46} y={35} r={3.1} />
            <text className="lesson-svg-label" x="94" y="36">перетащи вратаря</text>
          </svg>
        </div>
      );
    case "zones":
      return (
        <div className="lesson-visual lesson-zones" aria-hidden="true">
          <svg className="lesson-field-svg" viewBox="0 0 160 92">
            <rect className="lesson-grass" x="0" y="0" width="160" height="92" />
            <rect className="lesson-stripe" x="0" y="18" width="160" height="18" />
            <rect className="lesson-stripe" x="0" y="54" width="160" height="18" />
            <line className="goal-line-strong" x1="58" y1="86" x2="102" y2="86" />
            <polygon className="shot-angle" points="118,18 58,86 102,86" />
            <line className="analysis-line" x1="80" y1="86" x2="118" y2="18" />
            <g transform="rotate(28 79 62)">
              <rect className="danger-zone active" x="68" y="72" width="22" height="18" rx="9" />
              <rect className="almost-zone" x="62" y="38" width="34" height="42" rx="17" />
              <rect className="correct-zone" x="72" y="51" width="14" height="18" rx="7" />
              <rect className="danger-zone active" x="66" y="18" width="26" height="18" rx="9" />
            </g>
            <LessonGoalkeeper x={79} y={62} facing={28} />
            <circle className="keeper-foot-point" cx="79" cy="62" r="1.25" />
            <LessonBall x={118} y={18} />
            <text className="lesson-svg-label" x="103" y="31">опасно</text>
            <text className="lesson-svg-label" x="96" y="53">почти</text>
            <text className="lesson-svg-label" x="88" y="69">правильно</text>
          </svg>
        </div>
      );
    case "body":
      return (
        <div className="lesson-visual lesson-body" aria-hidden="true">
          <svg className="lesson-body-svg" viewBox="0 0 160 92">
            <rect className="lesson-grass" x="0" y="0" width="160" height="92" />
            <rect className="lesson-stripe" x="0" y="18" width="160" height="18" />
            <rect className="lesson-stripe" x="0" y="54" width="160" height="18" />
            <path className="line" d="M 45 70 L 115 70 L 115 92 L 45 92 Z" />
            <line className="analysis-line" x1="80" y1="68" x2="116" y2="22" />
            <LessonAttacker x={116} y={15} scale={1.4} />
            <LessonBall x={116} y={23} r={3.1} />
            <LessonGoalkeeper x={80} y={68} facing={38} scale={1.95} />
            <circle className="keeper-foot-point" cx="80" cy="68" r="1.3" />
            <text className="lesson-svg-label" x="96" y="57">стрелка корпуса</text>
          </svg>
          <div className="lesson-turn-buttons">
            <span>
              <RotateCcw size={16} />
            </span>
            <span>
              <RotateCw size={16} />
            </span>
          </div>
          <span className="lesson-caption turn-caption">эти кнопки поворачивают корпус</span>
        </div>
      );
    case "feedback":
      return (
        <div className="lesson-visual lesson-feedback" aria-hidden="true">
          <svg className="lesson-field-svg" viewBox="0 0 160 92">
            <rect className="lesson-grass" x="0" y="0" width="160" height="92" />
            <rect className="lesson-stripe" x="0" y="18" width="160" height="18" />
            <rect className="lesson-stripe" x="0" y="54" width="160" height="18" />
            <line className="goal-line-strong" x1="58" y1="86" x2="102" y2="86" />
            <line className="analysis-line" x1="80" y1="86" x2="118" y2="18" />
            <g transform="rotate(28 80 62)">
              <rect className="danger-zone active" x="69" y="74" width="22" height="16" rx="8" />
              <rect className="almost-zone" x="63" y="42" width="34" height="34" rx="17" />
              <rect className="correct-zone" x="73" y="54" width="14" height="16" rx="7" />
              <rect className="danger-zone active" x="67" y="20" width="26" height="16" rx="8" />
            </g>
            <LessonGoalkeeper x={80} y={62} facing={28} />
            <circle className="keeper-foot-point" cx="80" cy="62" r="1.25" />
            <LessonBall x={118} y={18} />
            <text className="lesson-svg-label" x="95" y="34">слишком далеко</text>
            <text className="lesson-svg-label" x="94" y="83">слишком глубоко</text>
          </svg>
          <div className="lesson-why-button">
            <Eye size={16} />
            <span>Показать почему</span>
          </div>
        </div>
      );
    case "wall":
      return (
        <div className="lesson-visual lesson-wall" aria-hidden="true">
          <svg className="lesson-field-svg" viewBox="0 0 160 92">
            <rect className="lesson-grass" x="0" y="0" width="160" height="92" />
            <rect className="lesson-stripe" x="0" y="18" width="160" height="18" />
            <rect className="lesson-stripe" x="0" y="54" width="160" height="18" />
            <path className="line" d="M 50 75 L 110 75 L 110 92 L 50 92 Z" />
            <line className="goal-line-strong" x1="58" y1="92" x2="102" y2="92" />
            <line className="analysis-line" x1="118" y1="18" x2="59" y2="92" />
            <rect className="wall-target-zone" x="72" y="45" width="28" height="18" rx="8" />
            <LessonWall x={86} y={58} count={3} />
            <LessonGoalkeeper x={74} y={82} facing={28} scale={1.35} />
            <LessonBall x={118} y={18} />
            <text className="lesson-svg-label" x="102" y="56">стенка</text>
            <text className="lesson-svg-label" x="34" y="82">вратарь</text>
          </svg>
        </div>
      );
    case "stats":
      return (
        <div className="lesson-visual lesson-icons" aria-hidden="true">
          <span>
            <BarChart3 size={22} />
          </span>
          <b>ошибки</b>
          <b>повторы</b>
        </div>
      );
    case "settings":
      return (
        <div className="lesson-visual lesson-icons" aria-hidden="true">
          <span>
            <Settings2 size={22} />
          </span>
          <b>поле</b>
          <b>ворота</b>
        </div>
      );
    default:
      return null;
  }
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
  }
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

function getNextLevelIndex(currentIndex: number, progress: Progress) {
  const repeatIndex = levels.findIndex((level, index) => {
    const item = progress[level.id];
    return index !== currentIndex && item?.needsRepeat && item.correctStreak < 2;
  });

  if (repeatIndex >= 0 && Math.random() < 0.35) {
    return repeatIndex;
  }

  return (currentIndex + 1) % levels.length;
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

function masteredCount(progress: Progress) {
  return levels.filter((level) => progress[level.id]?.correctStreak >= 2).length;
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
    case "NO_BALL_VISIBILITY":
      return "теряет обзор мяча за стенкой";
    case "WALL_COUNT_WRONG":
      return "ошибается с числом игроков в стенке";
    case "WALL_POSITION_WRONG":
      return "стенка не закрывает ближний угол";
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

function startFacingForLevel(level: Level, goalkeeper: Point, index: number) {
  const targetFacing = facingAngleToBall(goalkeeper, level.ball);
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

    if (level.category === "cross" || level.category === "corner") {
      return "Ты выбрал безопасную стартовую зону, видишь мяч и готов двигаться по траектории.";
    }

    return "Ты правильно выбрал игровую зону и закрыл угол удара.";
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
    return "Запомни правило: встань на линию мяча, выбери безопасную глубину и будь готов к удару.";
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
    case "startingPosition":
      return {
        key,
        label: "Стартовая позиция",
        status: depthStatus,
        text: depthStatus === "good" ? "можно выйти на мяч" : "старт спорный"
      };
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
      return level.title.includes("зал")
        ? "В зале угловой разыгрывается быстрее, поэтому ты держишь середину ворот и видишь мяч."
        : "При угловом важно стартовать там, где виден мяч, ворота под контролем и есть возможность выйти на подачу.";
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
  const [players, setPlayers] = useState<PlayerProfile[]>(() => loadPlayers());
  const [activePlayerId, setActivePlayerId] = useState(() => {
    const loadedPlayers = loadPlayers();
    return loadActivePlayerId(loadedPlayers);
  });
  const [playerSelected, setPlayerSelected] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [pitch, setPitch] = useState<PitchConfig>(() => loadPitch());
  const [progress, setProgress] = useState<Progress>(() => loadPlayerProgress(loadActivePlayerId(loadPlayers())));
  const [levelIndex, setLevelIndex] = useState(0);
  const [goalkeeper, setGoalkeeper] = useState<Point>(() => startGoalkeeperForLevel(levels[0], 0));
  const [goalkeeperFacing, setGoalkeeperFacing] = useState(() => startFacingForLevel(levels[0], startGoalkeeperForLevel(levels[0], 0), 0));
  const [wall, setWall] = useState<WallConfig>(() => startWallForLevel(levels[0]));
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [whyVisible, setWhyVisible] = useState(false);
  const [showDimensions, setShowDimensions] = useState(() => loadShowDimensions());
  const [onboardingComplete, setOnboardingComplete] = useState(() => loadOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsPlayerId, setStatsPlayerId] = useState(() => activePlayerId);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [draftPitch, setDraftPitch] = useState<PitchConfig>(() => pitch);
  const [draftShowDimensions, setDraftShowDimensions] = useState(showDimensions);
  const level = levels[levelIndex];
  const activePitch = level.pitchPresetOverride ? pitchPresets[level.pitchPresetOverride] : pitch;
  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const savedLevelIndex = Math.min(levels.length - 1, loadPlayerLastLevelIndex(activePlayerId));
  const hasTrainingToContinue = savedLevelIndex > 0 || Object.values(progress).some((item) => item.attempts > 0);
  const feedback = useMemo(() => (result ? buildFeedback(result, level) : null), [level, result]);
  const statsProgressByPlayer = useMemo(() => {
    return Object.fromEntries(players.map((player) => [player.id, player.id === activePlayerId ? progress : loadPlayerProgress(player.id)]));
  }, [activePlayerId, players, progress, statsRefreshKey]);
  const statsPlayer = players.find((player) => player.id === statsPlayerId) ?? activePlayer;

  const weakTopic = useMemo(() => {
    const repeated = levels.find((item) => progress[item.id]?.needsRepeat);
    return repeated ? categoryTitle(repeated.category) : "нет слабых тем";
  }, [progress]);

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
  }, [activePlayerId]);

  useEffect(() => {
    savePitch(pitch);
  }, [pitch]);

  useEffect(() => {
    savePlayerProgress(activePlayerId, progress);
  }, [progress]);

  useEffect(() => {
    saveShowDimensions(showDimensions);
  }, [showDimensions]);

  function moveToLevel(nextIndex: number, shouldSave = true) {
    const safeIndex = Math.max(0, Math.min(levels.length - 1, nextIndex));
    const nextGoalkeeper = startGoalkeeperForLevel(levels[safeIndex], safeIndex);
    setLevelIndex(safeIndex);
    setGoalkeeper(nextGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(levels[safeIndex], nextGoalkeeper, safeIndex));
    setWall(startWallForLevel(levels[safeIndex]));
    setResult(null);
    setHintVisible(false);
    setWhyVisible(false);

    if (shouldSave) {
      savePlayerLastLevelIndex(activePlayerId, safeIndex);
    }
  }

  function startTraining(mode: "restart" | "continue") {
    moveToLevel(mode === "continue" ? savedLevelIndex : 0);
    setPlayerSelected(true);
  }

  function submitAnswer() {
    const checked = checkAnswer(goalkeeper, level, activePitch, goalkeeperFacing, level.freeKick ? wall : undefined);
    setResult(checked);
    setWhyVisible(false);
    setProgress((current) => updateProgress(current, level, checked));
  }

  function nextLevel() {
    const nextIndex = getNextLevelIndex(levelIndex, progress);
    moveToLevel(nextIndex);
  }

  function resetLevel() {
    const startGoalkeeper = startGoalkeeperForLevel(level, levelIndex);
    setGoalkeeper(startGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(level, startGoalkeeper, levelIndex));
    setWall(startWallForLevel(level));
    setResult(null);
    setHintVisible(false);
    setWhyVisible(false);
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
    setSettingsOpen(true);
  }

  function openStats() {
    setStatsPlayerId(activePlayerId);
    setStatsOpen(true);
  }

  function saveSettings() {
    handlePitchChange(draftPitch);
    setShowDimensions(draftShowDimensions);
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
    savePlayerLastLevelIndex(player.id, 0);
    setActivePlayerId(player.id);
    setNewPlayerName("");
  }

  function deleteActivePlayer() {
    if (players.length <= 1) {
      return;
    }

    const nextPlayers = players.filter((player) => player.id !== activePlayerId);
    const nextPlayerId = nextPlayers[0].id;
    deletePlayerProgress(activePlayerId);
    deletePlayerLastLevelIndex(activePlayerId);
    setPlayers(nextPlayers);
    setActivePlayerId(nextPlayerId);
    setNewPlayerName("");
  }

  function openLevel(levelId: string) {
    const nextIndex = levels.findIndex((item) => item.id === levelId);

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
            <span>{masteredCount(progress)}</span>
            <small>закреплено</small>
          </div>
          <div>
            <span>{levels.length}</span>
            <small>ситуаций</small>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" onClick={openOnboarding}>
            <BookOpen size={18} />
            <span>Обучение</span>
          </button>
          <button type="button" onClick={openSettings}>
            <Settings2 size={18} />
            <span>Настройки</span>
          </button>
          <button type="button" onClick={openStats}>
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
            <div className={`result-pill ${resultClass(result)}`}>{resultLabel(result)}</div>
          </div>

          <FieldView
            pitch={activePitch}
            level={level}
            goalkeeper={goalkeeper}
            goalkeeperFacing={goalkeeperFacing}
            result={result}
            showAnalysis={whyVisible}
            showDimensions={showDimensions}
            visualHints={feedback?.visualHints ?? []}
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

            <p className="coach-text">{feedback ? feedback.summary : `${activePlayer?.name ?? "Игрок"}, выбери позицию до удара.`}</p>
            {feedback && result && (
              <>
                <div className="criteria-list" aria-label="Разбор решения">
                  {feedback.criteria.map((criterion) => (
                    <div className="criterion-row" key={criterion.key}>
                      <span className={`criterion-status ${criterion.status}`}>{criterionStatusText(criterion.status)}</span>
                      <div>
                        <strong>{criterion.label}</strong>
                        <small>{criterion.text}</small>
                      </div>
                    </div>
                  ))}
                </div>
                {whyVisible && (
                  <div className="zone-legend" aria-label="Обозначения зон">
                    <span>
                      <i className="legend-dot correct" />
                      правильно
                    </span>
                    <span>
                      <i className="legend-dot almost" />
                      почти
                    </span>
                    <span>
                      <i className="legend-dot danger" />
                      опасно
                    </span>
                  </div>
                )}
                <div className="how-card">
                  <strong>{result.result === "correct" ? "Как закрепить" : "Как поправить"}</strong>
                  <span>{feedback.mainAdvice}</span>
                </div>
                {whyVisible && (
                  <div className="why-card">
                    <strong>Почему так</strong>
                    <span>{feedback.details?.why}</span>
                    <span>{feedback.details?.howToFix}</span>
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
                <button className="primary" type="button" onClick={submitAnswer}>
                  <Target size={18} />
                  <span>Готов</span>
                </button>
              ) : (
                <button className="primary" type="button" onClick={nextLevel}>
                  <ChevronRight size={18} />
                  <span>Дальше</span>
                </button>
              )}

              {!result ? (
                <button type="button" onClick={() => setHintVisible(true)}>
                  <Lightbulb size={18} />
                  <span>Подсказка</span>
                </button>
              ) : (
                <button type="button" onClick={() => setWhyVisible((current) => !current)}>
                  <Eye size={18} />
                  <span>{whyVisible ? "Скрыть почему" : "Показать почему"}</span>
                </button>
              )}

              <button type="button" onClick={resetLevel}>
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
            <div className="summary-row">
              <span>Игрок</span>
              <strong>{activePlayer?.name}</strong>
            </div>
            <div className="summary-row">
              <span>Ситуация</span>
              <strong>
                {levelIndex + 1}/{levels.length}
              </strong>
            </div>
            <div className="summary-row">
              <span>Формат</span>
              <strong>{activePitch.name}</strong>
            </div>
            <button type="button" className="ghost" onClick={() => setShowDimensions(!showDimensions)}>
              <Eye size={17} />
              <span>{showDimensions ? "Скрыть размеры" : "Показать размеры"}</span>
            </button>
            <button type="button" className="ghost" onClick={openOnboarding}>
              <Lightbulb size={17} />
              <span>Обучение</span>
            </button>
          </section>
        </aside>
      </section>

      <div className="mobile-action-bar" aria-label="Действия тренировки">
        {!result ? (
          <button className="primary" type="button" onClick={submitAnswer}>
            <Target size={18} />
            <span>Готов</span>
          </button>
        ) : (
          <button className="primary" type="button" onClick={nextLevel}>
            <ChevronRight size={18} />
            <span>Дальше</span>
          </button>
        )}

        {!result ? (
          <button className="secondary" type="button" aria-label="Подсказка" onClick={() => setHintVisible(true)}>
            <Lightbulb size={18} />
            <span>Подсказка</span>
          </button>
        ) : (
          <button className="secondary" type="button" aria-label="Показать почему" onClick={() => setWhyVisible((current) => !current)}>
            <Eye size={18} />
            <span>Почему</span>
          </button>
        )}

        <button className="secondary" type="button" aria-label="Повтор" onClick={resetLevel}>
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
                onPitchChange={setDraftPitch}
                onShowDimensionsChange={setDraftShowDimensions}
              />
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
                <span>Отмена</span>
              </button>
              <button className="primary" type="button" onClick={saveSettings}>
                <Save size={18} />
                <span>Сохранить</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {!playerSelected && (
        <div className="modal-backdrop start-backdrop" role="presentation">
          <section className="modal start-modal" role="dialog" aria-modal="true" aria-label="Выбор игрока">
            <div className="modal-header">
              <div>
                <div className="eyebrow">Перед тренировкой</div>
                <h2>Кто сегодня тренируется?</h2>
              </div>
            </div>
            <div className="modal-grid single">
              <PlayerPanel
                players={players}
                activePlayerId={activePlayerId}
                newPlayerName={newPlayerName}
                onActivePlayerChange={setActivePlayerId}
                onNewPlayerNameChange={setNewPlayerName}
                onAddPlayer={addPlayer}
                onDeletePlayer={deleteActivePlayer}
              />
            </div>
            <div className="modal-actions">
              <div className="session-choice">
                <span>
                  {hasTrainingToContinue
                    ? `Можно продолжить с задания ${savedLevelIndex + 1} из ${levels.length}.`
                    : "У этого игрока пока нет начатой тренировки."}
                </span>
              </div>
              <button type="button" onClick={() => startTraining("restart")}>
                <RotateCcw size={18} />
                <span>Начать заново</span>
              </button>
              <button className="primary" type="button" onClick={() => startTraining("continue")}>
                <Play size={18} />
                <span>Продолжить</span>
              </button>
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
              levels={levels}
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
    </main>
  );
}
