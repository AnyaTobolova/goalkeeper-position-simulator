import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, ChevronRight, Eye, Lightbulb, Play, RotateCcw, RotateCw, Save, Settings2, Shield, Target, X } from "lucide-react";
import { FieldView } from "./components/FieldView";
import { PlayerPanel } from "./components/PlayerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsPanel } from "./components/StatsPanel";
import { checkAnswer } from "./domain/evaluate";
import { facingAngleToBall, normalizeAngle } from "./domain/geometry";
import { levels } from "./domain/levels";
import { pitchPresets } from "./domain/presets";
import type { CheckResult, ErrorType, Level, PitchConfig, PlayerProfile, Point, Progress, WallConfig } from "./domain/types";
import {
  loadActivePlayerId,
  loadOnboardingComplete,
  loadPitch,
  loadPlayerProgress,
  loadPlayers,
  loadShowDimensions,
  deletePlayerProgress,
  saveActivePlayerId,
  saveOnboardingComplete,
  savePitch,
  savePlayerProgress,
  savePlayers,
  saveShowDimensions
} from "./storage";

const onboardingCards = [
  {
    title: "Позиция вратаря",
    text: "Перетаскивай вратаря по полю. Для оценки важна белая точка у ног: именно она должна попасть в правильную зону."
  },
  {
    title: "Корпус к мячу",
    text: "Маленькая стрелка на вратаре показывает, куда развернут корпус. Ее можно потянуть на поле или повернуть корпус кнопками в панели справа."
  },
  {
    title: "Стенка при штрафном",
    text: "В штрафных заданиях появится блок 'Стенка'. Выбери число игроков кнопками плюс/минус и перетащи стенку на поле."
  },
  {
    title: "Подсказка",
    text: "До ответа игра не раскрывает решение. Если трудно, нажми 'Подсказка'. После проверки появятся объяснение и правильная зона."
  },
  {
    title: "Игроки и статистика",
    text: "Можно добавить нескольких детей без регистрации. В статистике выбирай игрока и смотри его ошибки, слабые темы и задания для повтора."
  },
  {
    title: "Поле и ворота",
    text: "В настройках можно менять формат игры, размеры поля и ворот. Это полезно, если матчи проходят на разных площадках."
  }
];

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

  return "Разберем";
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
      wrongAttempts: previous.wrongAttempts + (result.result === "wrong" ? 1 : 0),
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
    case "PASSIVE_1V1":
      return "пассивность в 1-в-1";
    case "RUSHED_1V1":
      return "слишком ранний выход";
    case "IGNORED_DEFENDER":
      return "не учитывает защитника";
    case "NOT_ADJUSTED_AFTER_PASS":
      return "не перестраивается после паса";
    case "WRONG_BODY_ANGLE":
      return "корпус не повернут к мячу";
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
        : "На открытом поле при угловом ты занял стойку под подачу и видишь поле перед собой.";
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
  const footPointOutside = result.evaluation.notes.some((note) => note.includes("точка стоп") || note.includes("точка ног"));

  if (result.result === "almost" && footPointOutside) {
    return "Позиция почти правильная. Для зачета белая точка стоп должна попасть в зеленый прицел, а не только фигурка вратаря.";
  }

  switch (errorType) {
    case "WALL_COUNT_WRONG":
      return "Для штрафного сначала выбери правильное число игроков в стенке. Слишком маленькая стенка оставит ближний угол, слишком большая заберет лишних защитников.";
    case "WALL_POSITION_WRONG":
      return "Стенка должна стоять на линии удара к ближней штанге и закрывать ближний угол. Вратарь отвечает за открытую часть ворот.";
    case "NEAR_POST_OPEN":
      return "Смотри на штангу рядом с мячом. Если она открыта, нападающий получает простой удар.";
    case "TOO_DEEP":
      return "Ты слишком близко к воротам. Сделай шаг вперед, чтобы уменьшить угол удара.";
    case "TOO_HIGH":
      return "Ты вышел слишком далеко. Так нападающий может обыграть или перебросить.";
    case "PASSIVE_1V1":
      return "В 1-в-1 нельзя просто ждать на линии. Нужно выйти и сделать ворота меньше.";
    case "RUSHED_1V1":
      return "Выходить нужно быстро, но перед ударом лучше остановиться и быть готовым.";
    case "IGNORED_DEFENDER":
      return "Посмотри на защитника. Если он уже давит на игрока, не всегда нужно выбегать.";
    case "NOT_ADJUSTED_AFTER_PASS":
      return "Мяч ушел в другую точку, значит и твоя позиция должна поменяться.";
    case "WRONG_BODY_ANGLE":
      return "Вратарь должен смотреть корпусом на мяч. Так легче сделать первый шаг и не потерять ближний угол.";
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
    return "Ищи точку на линии от мяча к середине ворот. Не оставайся на линии ворот или внутри ворот, а корпус поверни к мячу.";
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

  return `Как надо: ${horizontal}, ${vertical}. На поле смотри на белую точку стоп: она должна попасть в зеленый прицел.`;
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
  const [showDimensions, setShowDimensions] = useState(() => loadShowDimensions());
  const [onboardingComplete, setOnboardingComplete] = useState(() => loadOnboardingComplete());
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsPlayerId, setStatsPlayerId] = useState(() => activePlayerId);
  const [draftPitch, setDraftPitch] = useState<PitchConfig>(() => pitch);
  const [draftShowDimensions, setDraftShowDimensions] = useState(showDimensions);
  const level = levels[levelIndex];
  const activePitch = level.pitchPresetOverride ? pitchPresets[level.pitchPresetOverride] : pitch;
  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const statsProgressByPlayer = useMemo(() => {
    return Object.fromEntries(players.map((player) => [player.id, player.id === activePlayerId ? progress : loadPlayerProgress(player.id)]));
  }, [activePlayerId, players, progress]);
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

  function submitAnswer() {
    const checked = checkAnswer(goalkeeper, level, activePitch, goalkeeperFacing, level.freeKick ? wall : undefined);
    setResult(checked);
    setProgress((current) => updateProgress(current, level, checked));
  }

  function nextLevel() {
    const nextIndex = getNextLevelIndex(levelIndex, progress);
    const nextGoalkeeper = startGoalkeeperForLevel(levels[nextIndex], nextIndex);
    setLevelIndex(nextIndex);
    setGoalkeeper(nextGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(levels[nextIndex], nextGoalkeeper, nextIndex));
    setWall(startWallForLevel(levels[nextIndex]));
    setResult(null);
    setHintVisible(false);
  }

  function resetLevel() {
    const startGoalkeeper = startGoalkeeperForLevel(level, levelIndex);
    setGoalkeeper(startGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(level, startGoalkeeper, levelIndex));
    setWall(startWallForLevel(level));
    setResult(null);
    setHintVisible(false);
  }

  function rotateGoalkeeper(delta: number) {
    setGoalkeeperFacing((current) => normalizeAngle(current + delta));
  }

  function handlePitchChange(nextPitch: PitchConfig) {
    setPitch(nextPitch);
    setResult(null);
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
    setPlayers(nextPlayers);
    setActivePlayerId(nextPlayerId);
    setNewPlayerName("");
  }

  function openLevel(levelId: string) {
    const nextIndex = levels.findIndex((item) => item.id === levelId);

    if (nextIndex < 0) {
      return;
    }

    setLevelIndex(nextIndex);
    const nextGoalkeeper = startGoalkeeperForLevel(levels[nextIndex], nextIndex);
    setGoalkeeper(nextGoalkeeper);
    setGoalkeeperFacing(startFacingForLevel(levels[nextIndex], nextGoalkeeper, nextIndex));
    setWall(startWallForLevel(levels[nextIndex]));
    setResult(null);
    setHintVisible(false);
    setStatsOpen(false);
  }

  function trainStatsPlayer(playerId: string) {
    setActivePlayerId(playerId);
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
            showDimensions={showDimensions}
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
              <span>Решение</span>
            </div>

            <p className="coach-text">{result ? result.text : `${activePlayer?.name ?? "Игрок"}, выбери позицию до удара.`}</p>
            {result && (
              <>
                <div className="why-card">
                  <strong>Почему так</strong>
                  <span>{explainDecision(result, level)}</span>
                </div>
                <div className="how-card">
                  <strong>Как надо стоять</strong>
                  <span>{placementAdvice(result, goalkeeper)}</span>
                </div>
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

            {result?.evaluation.notes.length ? (
              <ul className="notes">
                {result.evaluation.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}

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

              <button type="button" onClick={() => setHintVisible(true)} disabled={Boolean(result)}>
                <Lightbulb size={18} />
                <span>Подсказка</span>
              </button>

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
              <span>Как играть</span>
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

        <button className="secondary" type="button" aria-label="Подсказка" onClick={() => setHintVisible(true)} disabled={Boolean(result)}>
          <Lightbulb size={18} />
          <span>Подсказка</span>
        </button>

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
              <button className="primary" type="button" onClick={() => setPlayerSelected(true)}>
                <Play size={18} />
                <span>Начать тренировку</span>
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
                <div className="eyebrow">Первый запуск</div>
                <h2>Как играть</h2>
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
            />
          </section>
        </div>
      )}
    </main>
  );
}
