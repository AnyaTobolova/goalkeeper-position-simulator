import type { PitchConfig, PlayerProfile, Progress, ReactionDifficulty, ReactionTimeSeconds, TrainingMode } from "./domain/types";
import { pitchPresets } from "./domain/presets";

const progressKey = "goalkeeper-sim:progress";
const playersKey = "goalkeeper-sim:players";
const activePlayerKey = "goalkeeper-sim:active-player";
const pitchKey = "goalkeeper-sim:pitch";
const dimensionsKey = "goalkeeper-sim:show-dimensions";
const onboardingKey = "goalkeeper-sim:onboarding-complete";
const reactionDifficultyKey = "goalkeeper-sim:reaction-difficulty";
const reactionTimeSecondsKey = "goalkeeper-sim:reaction-time-seconds";
const trainingModeKey = "goalkeeper-sim:training-mode";

function createDefaultPlayer(): PlayerProfile {
  return {
    id: `player-${Date.now()}`,
    name: "Игрок 1",
    createdAt: new Date().toISOString()
  };
}

function playerProgressKey(playerId: string) {
  return `goalkeeper-sim:progress:${playerId}`;
}

function legacyPlayerLastLevelKey(playerId: string) {
  return `goalkeeper-sim:last-level:${playerId}`;
}

function playerLastLevelKey(playerId: string, mode: TrainingMode) {
  return `goalkeeper-sim:last-level:${mode}:${playerId}`;
}

export function loadPlayers(): PlayerProfile[] {
  try {
    const saved = localStorage.getItem(playersKey);

    if (saved) {
      const parsed = JSON.parse(saved) as PlayerProfile[];

      if (parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ниже создается локальный профиль по умолчанию.
  }

  const defaultPlayer = createDefaultPlayer();
  savePlayers([defaultPlayer]);
  localStorage.setItem(activePlayerKey, defaultPlayer.id);
  return [defaultPlayer];
}

export function savePlayers(players: PlayerProfile[]) {
  localStorage.setItem(playersKey, JSON.stringify(players));
}

export function loadActivePlayerId(players: PlayerProfile[]) {
  const saved = localStorage.getItem(activePlayerKey);

  if (saved && players.some((player) => player.id === saved)) {
    return saved;
  }

  const firstPlayerId = players[0]?.id ?? createDefaultPlayer().id;
  localStorage.setItem(activePlayerKey, firstPlayerId);
  return firstPlayerId;
}

export function saveActivePlayerId(playerId: string) {
  localStorage.setItem(activePlayerKey, playerId);
}

export function loadPlayerProgress(playerId: string): Progress {
  try {
    const saved = localStorage.getItem(playerProgressKey(playerId));

    if (saved) {
      return JSON.parse(saved) as Progress;
    }

    return {};
  } catch {
    return {};
  }
}

export function savePlayerProgress(playerId: string, progress: Progress) {
  localStorage.setItem(playerProgressKey(playerId), JSON.stringify(progress));
}

export function deletePlayerProgress(playerId: string) {
  localStorage.removeItem(playerProgressKey(playerId));
}

export function loadPlayerLastLevelIndex(playerId: string, mode: TrainingMode = "base_position") {
  const saved = localStorage.getItem(playerLastLevelKey(playerId, mode)) ?? (mode === "base_position" ? localStorage.getItem(legacyPlayerLastLevelKey(playerId)) : null);
  const parsed = Number(saved);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function savePlayerLastLevelIndex(playerId: string, levelIndex: number, mode: TrainingMode = "base_position") {
  localStorage.setItem(playerLastLevelKey(playerId, mode), String(Math.max(0, Math.floor(levelIndex))));
}

export function deletePlayerLastLevelIndex(playerId: string) {
  localStorage.removeItem(legacyPlayerLastLevelKey(playerId));
  localStorage.removeItem(playerLastLevelKey(playerId, "base_position"));
  localStorage.removeItem(playerLastLevelKey(playerId, "reaction_to_ball_owner"));
}

export function loadPitch(): PitchConfig {
  try {
    const saved = localStorage.getItem(pitchKey);

    if (!saved) {
      return pitchPresets["7v7"];
    }

    const parsed = JSON.parse(saved) as PitchConfig;

    if (parsed.presetId !== "custom" && pitchPresets[parsed.presetId]) {
      return {
        ...pitchPresets[parsed.presetId],
        goalPresetId: parsed.goalPresetId,
        goalWidth: parsed.goalWidth,
        goalHeight: parsed.goalHeight
      };
    }

    return parsed;
  } catch {
    return pitchPresets["7v7"];
  }
}

export function savePitch(pitch: PitchConfig) {
  localStorage.setItem(pitchKey, JSON.stringify(pitch));
}

export function loadShowDimensions() {
  return localStorage.getItem(dimensionsKey) === "true";
}

export function saveShowDimensions(show: boolean) {
  localStorage.setItem(dimensionsKey, String(show));
}

export function loadOnboardingComplete() {
  return localStorage.getItem(onboardingKey) === "true";
}

export function saveOnboardingComplete(done: boolean) {
  localStorage.setItem(onboardingKey, String(done));
}

export function loadReactionDifficulty(): ReactionDifficulty {
  const saved = localStorage.getItem(reactionDifficultyKey);

  if (saved === "easy" || saved === "medium" || saved === "hard") {
    return saved;
  }

  return "easy";
}

export function loadReactionTimeSeconds(): ReactionTimeSeconds {
  const saved = Number(localStorage.getItem(reactionTimeSecondsKey));

  if (saved === 5 || saved === 4 || saved === 3) {
    return saved;
  }

  const legacyDifficulty = loadReactionDifficulty();
  if (legacyDifficulty === "medium") return 4;
  if (legacyDifficulty === "hard") return 3;
  return 5;
}

export function saveReactionTimeSeconds(seconds: ReactionTimeSeconds) {
  localStorage.setItem(reactionTimeSecondsKey, String(seconds));
}

export function loadTrainingMode(): TrainingMode {
  const saved = localStorage.getItem(trainingModeKey);

  if (saved === "base_position" || saved === "reaction_to_ball_owner") {
    return saved;
  }

  return "base_position";
}

export function saveTrainingMode(mode: TrainingMode) {
  localStorage.setItem(trainingModeKey, mode);
}

function penaltyBestKey(playerId: string) {
  return `goalkeeper-sim:penalty-best:${playerId}`;
}

export function loadPenaltyBest(playerId: string): number | null {
  const saved = Number(localStorage.getItem(penaltyBestKey(playerId)));
  return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : null;
}

export function savePenaltyBest(playerId: string, saves: number) {
  const best = loadPenaltyBest(playerId) ?? 0;

  if (saves > best) {
    localStorage.setItem(penaltyBestKey(playerId), String(Math.floor(saves)));
  }
}

export type DayStreak = {
  lastDate: string;
  streak: number;
  best: number;
};

function dayStreakKey(playerId: string) {
  return `goalkeeper-sim:day-streak:${playerId}`;
}

export function loadDayStreak(playerId: string): DayStreak | null {
  try {
    const saved = localStorage.getItem(dayStreakKey(playerId));
    return saved ? (JSON.parse(saved) as DayStreak) : null;
  } catch {
    return null;
  }
}

// Отмечает выполненную «Тренировку дня»: вчера тоже тренировался - серия растет,
// был пропуск - серия начинается заново, сегодня уже отмечено - без изменений.
export function recordDayTraining(playerId: string, todayIso: string): DayStreak {
  const current = loadDayStreak(playerId);

  if (current && current.lastDate === todayIso) {
    return current;
  }

  const yesterday = new Date(new Date(`${todayIso}T12:00:00`).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const streak = current && current.lastDate === yesterday ? current.streak + 1 : 1;
  const next: DayStreak = { lastDate: todayIso, streak, best: Math.max(streak, current?.best ?? 0) };
  localStorage.setItem(dayStreakKey(playerId), JSON.stringify(next));
  return next;
}

function marathonBestKey(playerId: string) {
  return `goalkeeper-sim:marathon-best:${playerId}`;
}

export function loadMarathonBest(playerId: string): number | null {
  const saved = Number(localStorage.getItem(marathonBestKey(playerId)));
  return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : null;
}

export function saveMarathonBest(playerId: string, score: number) {
  const best = loadMarathonBest(playerId) ?? 0;

  if (score > best) {
    localStorage.setItem(marathonBestKey(playerId), String(Math.floor(score)));
  }
}
