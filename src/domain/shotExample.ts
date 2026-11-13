import { fromMeters, toMeters } from "./geometry";
import { openGoalSegments, openGoalSegmentsWithWall } from "./openGoalSegments";
import type { Level, PitchConfig, Point, WallConfig } from "./types";

// Наглядный пример удара по плоской схеме, а не прогноз исхода или оценка ответа.
export function shotExample(level: Level, goalkeeper: Point, pitch: PitchConfig, wall?: WallConfig) {
  const ball = toMeters(level.ball, pitch);
  const keeper = toMeters(goalkeeper, pitch);
  const segments = level.freeKick && wall
    ? openGoalSegmentsWithWall(ball, keeper, pitch, { ...toMeters(wall, pitch), count: wall.count })
    : openGoalSegments(ball, keeper, pitch);
  const widest = segments.reduce<[number, number] | undefined>(
    (best, segment) => !best || segment[1] - segment[0] > best[1] - best[0] ? segment : best,
    undefined
  );
  const choice = Array.from(level.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const isGoal = Boolean(widest && widest[1] - widest[0] > 0.01 && choice % 2 === 0);
  return { isGoal, target: isGoal && widest ? fromMeters({ x: (widest[0] + widest[1]) / 2, y: 0 }, pitch) : goalkeeper };
}
