import { AlertTriangle, BarChart3, ListRestart, Trash2 } from "lucide-react";
import type { ErrorType, Level, PlayerProfile, Progress } from "../domain/types";

type StatsPanelProps = {
  levels: Level[];
  players: PlayerProfile[];
  activePlayerId: string;
  selectedPlayerId: string;
  progressByPlayer: Record<string, Progress>;
  onSelectedPlayerChange: (playerId: string) => void;
  onTrainPlayer: (playerId: string) => void;
  onOpenLevel: (levelId: string) => void;
  onClearPlayerProgress: (playerId: string) => void;
};

const errorTitles: Record<ErrorType, string> = {
  TOO_CENTRAL: "Остался по центру",
  TOO_LEFT: "Слишком слева",
  TOO_RIGHT: "Слишком справа",
  TOO_DEEP: "Слишком глубоко",
  TOO_HIGH: "Слишком высоко",
  NEAR_POST_OPEN: "Открыт ближний угол",
  OVERPROTECTS_NEAR_POST: "Прижался к штанге",
  PASSIVE_1V1: "Пассивно в 1-в-1",
  RUSHED_1V1: "Ранний выход",
  IGNORED_DEFENDER: "Не учтен защитник",
  NOT_ADJUSTED_AFTER_PASS: "Не перестроился после паса",
  STUCK_NEAR_POST: "Застрял у штанги",
  WRONG_BODY_ANGLE: "Корпус не к мячу",
  NO_BALL_VISIBILITY: "Не видит мяч",
  WALL_COUNT_WRONG: "Неверная стенка",
  WALL_POSITION_WRONG: "Стенка не там"
};

const errorHints: Record<ErrorType, string> = {
  TOO_CENTRAL: "Мяч сбоку, позиция тоже должна сместиться.",
  TOO_LEFT: "Проверь линию мяча и не переезжай дальше нужного.",
  TOO_RIGHT: "Проверь линию мяча и не переезжай дальше нужного.",
  TOO_DEEP: "Выйди выше, чтобы уменьшить видимый размер ворот.",
  TOO_HIGH: "Остановись раньше, чтобы не открыть обводку или переброс.",
  NEAR_POST_OPEN: "Сначала закрой штангу рядом с мячом.",
  OVERPROTECTS_NEAR_POST: "Закрывай ближний угол, но не бросай всю дальнюю часть ворот.",
  PASSIVE_1V1: "Сократи угол и будь готов к удару.",
  RUSHED_1V1: "Выходи быстро, но остановись перед ударом.",
  IGNORED_DEFENDER: "Оцени, давит ли защитник на игрока с мячом.",
  NOT_ADJUSTED_AFTER_PASS: "После паса ищи новую линию мяча.",
  STUCK_NEAR_POST: "После прострела или отката двигайся за новой точкой мяча.",
  WRONG_BODY_ANGLE: "Поверни корпус к мячу, не только поставь ноги в точку.",
  NO_BALL_VISIBILITY: "Стенка должна помогать, но мяч все равно нужно видеть.",
  WALL_COUNT_WRONG: "Подбери число игроков под опасность удара.",
  WALL_POSITION_WRONG: "Стенка закрывает ближний угол, вратарь - открытую часть."
};

function collectErrorStats(progress: Progress) {
  const totals = new Map<ErrorType, number>();

  Object.values(progress).forEach((levelProgress) => {
    Object.entries(levelProgress.errorCounts ?? {}).forEach(([errorType, count]) => {
      totals.set(errorType as ErrorType, (totals.get(errorType as ErrorType) ?? 0) + (count ?? 0));
    });
  });

  return Array.from(totals.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

function collectWeakLevels(levels: Level[], progress: Progress) {
  return levels
    .map((level) => ({ level, progress: progress[level.id] }))
    .filter(({ progress: item }) => item?.needsRepeat || (item?.wrongAttempts ?? 0) > 0 || (item?.almostAttempts ?? 0) > 0)
    .sort((a, b) => {
      const aMistakes = (a.progress?.wrongAttempts ?? 0) * 2 + (a.progress?.almostAttempts ?? 0);
      const bMistakes = (b.progress?.wrongAttempts ?? 0) * 2 + (b.progress?.almostAttempts ?? 0);
      return bMistakes - aMistakes;
    })
    .slice(0, 5);
}

export function StatsPanel({ levels, players, activePlayerId, selectedPlayerId, progressByPlayer, onSelectedPlayerChange, onTrainPlayer, onOpenLevel, onClearPlayerProgress }: StatsPanelProps) {
  const progress = progressByPlayer[selectedPlayerId] ?? {};
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const errorStats = collectErrorStats(progress);
  const weakLevels = collectWeakLevels(levels, progress);
  const attempts = Object.values(progress).reduce((sum, item) => sum + item.attempts, 0);
  const mistakes = Object.values(progress).reduce((sum, item) => sum + (item.wrongAttempts ?? 0) + (item.almostAttempts ?? 0), 0);
  const mastered = levels.filter((level) => progress[level.id]?.correctStreak >= 2).length;

  return (
    <section className="panel stats-panel">
      <div className="panel-title">
        <BarChart3 size={18} />
        <span>Ошибки</span>
      </div>

      <label className="stats-player-select">
        <span>Игрок</span>
        <select value={selectedPlayer?.id} onChange={(event) => onSelectedPlayerChange(event.target.value)}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </label>

      <div className="stats-actions">
        {selectedPlayer && selectedPlayer.id !== activePlayerId && (
          <button className="ghost stats-train-button" type="button" onClick={() => onTrainPlayer(selectedPlayer.id)}>
            Тренировать этого игрока
          </button>
        )}
        {selectedPlayer && attempts > 0 && (
          <button className="danger-button stats-clear-button" type="button" onClick={() => onClearPlayerProgress(selectedPlayer.id)}>
            <Trash2 size={16} />
            <span>Очистить статистику</span>
          </button>
        )}
      </div>

      <div className="summary-row">
        <span>Попыток</span>
        <strong>{attempts}</strong>
      </div>
      <div className="summary-row">
        <span>Ошибок</span>
        <strong>{mistakes}</strong>
      </div>
      <div className="summary-row">
        <span>Закреплено</span>
        <strong>
          {mastered}/{levels.length}
        </strong>
      </div>

      {errorStats.length === 0 ? (
        <p className="empty-stats">Ошибок пока нет. После тренировки здесь появятся слабые места.</p>
      ) : (
        <div className="error-list">
          {errorStats.slice(0, 4).map((item) => (
            <div className="error-item" key={item.type}>
              <div>
                <strong>{errorTitles[item.type]}</strong>
                <span>{errorHints[item.type]}</span>
              </div>
              <b>{item.count}</b>
            </div>
          ))}
        </div>
      )}

      {weakLevels.length > 0 && (
        <div className="weak-levels">
          <div className="mini-title">
            <AlertTriangle size={16} />
            <span>Задания для повтора</span>
          </div>
          {weakLevels.map(({ level, progress: item }) => (
            <button className="weak-level-button" type="button" key={level.id} onClick={() => onOpenLevel(level.id)}>
              <ListRestart size={16} />
              <span>{level.title}</span>
              <small>{(item?.wrongAttempts ?? 0) + (item?.almostAttempts ?? 0) || "повтор"}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
