import { fromMeters, toMeters } from "./geometry";
import { openGoalSegments, openGoalSegmentsWithWall } from "./openGoalSegments";
import type { CheckResult, Level, PitchConfig, Point, WallConfig } from "./types";

// Наглядный пример удара по плоской схеме, а не прогноз исхода или оценка ответа.
export function shotExample(result: CheckResult, level: Level, goalkeeper: Point, pitch: PitchConfig, wall?: WallConfig) {
  if (result.result === "correct") return { isGoal: false, target: goalkeeper };
  const ball = toMeters(level.ball, pitch);
  const keeper = toMeters(goalkeeper, pitch);
  const segments = level.freeKick && wall
    ? openGoalSegmentsWithWall(ball, keeper, pitch, { ...toMeters(wall, pitch), count: wall.count })
    : openGoalSegments(ball, keeper, pitch);
  const widest = segments.reduce<[number, number] | undefined>(
    (best, segment) => !best || segment[1] - segment[0] > best[1] - best[0] ? segment : best,
    undefined
  );
  if (!widest || widest[1] - widest[0] <= 0.01) return null;
  return { isGoal: true, target: fromMeters({ x: (widest[0] + widest[1]) / 2, y: 0 }, pitch) };
}
