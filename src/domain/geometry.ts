import type { PitchConfig, Point, Zone } from "./types";

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function toMeters(point: Point, pitch: PitchConfig): Point {
  return {
    x: (point.x / 100) * pitch.fieldWidth,
    y: (point.y / 100) * pitch.fieldLength
  };
}

export function fromMeters(point: Point, pitch: PitchConfig): Point {
  return {
    x: (point.x / pitch.fieldWidth) * 100,
    y: (point.y / pitch.fieldLength) * 100
  };
}

export function goalCenter(pitch: PitchConfig): Point {
  return { x: pitch.fieldWidth / 2, y: 0 };
}

export function leftPost(pitch: PitchConfig): Point {
  return { x: pitch.fieldWidth / 2 - pitch.goalWidth / 2, y: 0 };
}

export function rightPost(pitch: PitchConfig): Point {
  return { x: pitch.fieldWidth / 2 + pitch.goalWidth / 2, y: 0 };
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distancePointToLine(point: Point, lineA: Point, lineB: Point) {
  const dx = lineB.x - lineA.x;
  const dy = lineB.y - lineA.y;
  const denominator = Math.hypot(dx, dy);

  if (denominator === 0) {
    return distance(point, lineA);
  }

  return Math.abs(dy * point.x - dx * point.y + lineB.x * lineA.y - lineB.y * lineA.x) / denominator;
}

export function isInsideZone(point: Point, zone: Zone) {
  return point.x >= zone.xMin && point.x <= zone.xMax && point.y >= zone.yMin && point.y <= zone.yMax;
}

export function angleDegrees(a: Point, vertex: Point, b: Point) {
  const av = { x: a.x - vertex.x, y: a.y - vertex.y };
  const bv = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = av.x * bv.x + av.y * bv.y;
  const magnitude = Math.hypot(av.x, av.y) * Math.hypot(bv.x, bv.y);

  if (magnitude === 0) {
    return 0;
  }

  return (Math.acos(clamp(dot / magnitude, -1, 1)) * 180) / Math.PI;
}

export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export function angleDifference(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(diff, 360 - diff);
}

export function facingAngleToBall(goalkeeper: Point, ball: Point) {
  return normalizeAngle((Math.atan2(ball.x - goalkeeper.x, ball.y - goalkeeper.y) * 180) / Math.PI);
}
