import type { PitchConfig, PlayerProfile, Progress } from "./domain/types";
import { pitchPresets } from "./domain/presets";

const progressKey = "goalkeeper-sim:progress";
const playersKey = "goalkeeper-sim:players";
const activePlayerKey = "goalkeeper-sim:active-player";
const pitchKey = "goalkeeper-sim:pitch";
const dimensionsKey = "goalkeeper-sim:show-dimensions";
const onboardingKey = "goalkeeper-sim:onboarding-complete";

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

function playerLastLevelKey(playerId: string) {
  return `goalkeeper-sim:last-level:${playerId}`;
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

export function loadPlayerLastLevelIndex(playerId: string) {
  const saved = localStorage.getItem(playerLastLevelKey(playerId));
  const parsed = Number(saved);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function savePlayerLastLevelIndex(playerId: string, levelIndex: number) {
  localStorage.setItem(playerLastLevelKey(playerId), String(Math.max(0, Math.floor(levelIndex))));
}

export function deletePlayerLastLevelIndex(playerId: string) {
  localStorage.removeItem(playerLastLevelKey(playerId));
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
