import { keeperReachWidth, leftPost, rightPost } from "./geometry";
import type { PitchConfig, Point } from "./types";

// Та же проекция досягаемости вратаря, что в openGoalShare, но с границами
// открытых отрезков для рисунка. Оценку позиции эта функция не меняет.
export function openGoalSegments(ball: Point, keeper: Point, pitch: PitchConfig): [number, number][] {
  const left = leftPost(pitch).x;
  const right = rightPost(pitch).x;
  if (ball.y <= 0.2 || keeper.y >= ball.y - 0.3) return [[left, right]];

  const dx = keeper.x - ball.x;
  const dy = keeper.y - ball.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const half = keeperReachWidth / 2;
  const edges = [1, -1].map((sign) => ({
    x: keeper.x + sign * (-dy / length) * half,
    y: keeper.y + sign * (dx / length) * half
  }));
  const projected = edges.filter((edge) => edge.y < ball.y - 0.05).map((edge) =>
    ball.x + (edge.x - ball.x) * ball.y / (ball.y - edge.y)
  );
  if (projected.length < 2) return [[left, right]];

  const shadowLeft = Math.max(left, Math.min(projected[0], projected[1]));
  const shadowRight = Math.min(right, Math.max(projected[0], projected[1]));
  if (shadowRight <= left || shadowLeft >= right) return [[left, right]];
  const segments: [number, number][] = [];
  if (shadowLeft > left) segments.push([left, shadowLeft]);
  if (shadowRight < right) segments.push([shadowRight, right]);
  return segments;
}

// Оценочная ширина детской стенки: 0,5 м на игрока, плечом к плечу.
// Это только наглядная модель на плоскости, без учёта высоты удара.
export const wallPlayerWidthMeters = 0.5;

export function wallWidthMeters(count: number): number {
  return Math.max(0, count) * wallPlayerWidthMeters;
}

export function openGoalSegmentsWithWall(
  ball: Point,
  keeper: Point,
  pitch: PitchConfig,
  wall: Point & { count: number }
): [number, number][] {
  const segments = openGoalSegments(ball, keeper, pitch);
  if (wall.count <= 0 || ball.y <= 0.2 || wall.y < 0 || wall.y >= ball.y - 0.05) return segments;

  const halfWidth = wallWidthMeters(wall.count) / 2;
  const projectionFactor = ball.y / (ball.y - wall.y);
  const shadowLeft = ball.x + (wall.x - halfWidth - ball.x) * projectionFactor;
  const shadowRight = ball.x + (wall.x + halfWidth - ball.x) * projectionFactor;
  return segments.flatMap(([start, end]): [number, number][] => {
    if (shadowRight <= start || shadowLeft >= end) return [[start, end]];
    const remaining: [number, number][] = [];
    if (shadowLeft > start) remaining.push([start, Math.min(shadowLeft, end)]);
    if (shadowRight < end) remaining.push([Math.max(shadowRight, start), end]);
    return remaining;
  });
}
