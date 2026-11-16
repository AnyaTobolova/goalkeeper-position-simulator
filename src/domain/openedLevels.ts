import type { Level, Progress, TrainingMode } from "./types";

// Открыты достигнутые по программе и уже сыгранные в других режимах ситуации.
export function openedLevels(levels: Level[], progress: Progress, lastIndex: Record<TrainingMode, number>): Level[] {
  const positions: Record<TrainingMode, number> = { base_position: 0, reaction_to_ball_owner: 0 };
  return levels.filter((level) => {
    const mode: TrainingMode = level.stage === "reaction_to_ball_owner" ? "reaction_to_ball_owner" : "base_position";
    const index = positions[mode]++;
    return index <= lastIndex[mode] || (progress[level.id]?.attempts ?? 0) > 0;
  });
}
