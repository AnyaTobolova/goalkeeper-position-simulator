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

// Ширина, которую юный вратарь накрывает в прыжке из рабочей стойки:
// корпус плюс досягаемость рук в обе стороны.
export const keeperReachWidth = 2.4;

// Доля ширины ворот, открытая для удара из точки мяча: вратарь перекрывает
// коридор досягаемостью в прыжке (bodyWidth в метрах). Тень вратаря
// проецируется из мяча на линию ворот и вычитается из ширины ворот.
export function openGoalShare(ballMeters: Point, keeperMeters: Point, pitch: PitchConfig, bodyWidth = keeperReachWidth) {
  const left = leftPost(pitch).x;
  const right = rightPost(pitch).x;

  if (ballMeters.y <= 0.2) {
    return 1;
  }

  if (keeperMeters.y >= ballMeters.y - 0.3) {
    return 1;
  }

  const dx = keeperMeters.x - ballMeters.x;
  const dy = keeperMeters.y - ballMeters.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const perp = { x: -dy / len, y: dx / len };
  const half = bodyWidth / 2;
  const edges = [
    { x: keeperMeters.x + perp.x * half, y: keeperMeters.y + perp.y * half },
    { x: keeperMeters.x - perp.x * half, y: keeperMeters.y - perp.y * half }
  ];
  const projections = edges
    .filter((edge) => edge.y < ballMeters.y - 0.05)
    .map((edge) => {
      const t = ballMeters.y / (ballMeters.y - edge.y);
      return ballMeters.x + (edge.x - ballMeters.x) * t;
    });

  if (projections.length < 2) {
    return 1;
  }

  const shadowMin = Math.min(projections[0], projections[1]);
  const shadowMax = Math.max(projections[0], projections[1]);
  const overlap = Math.max(0, Math.min(shadowMax, right) - Math.max(shadowMin, left));

  return clamp(1 - overlap / pitch.goalWidth, 0, 1);
}

// Самый открытый участок ворот с учетом тени вратаря: центр наибольшего
// свободного отрезка на линии ворот (для анимации удара в открытую часть).
export function widestOpenGoalPoint(ballMeters: Point, keeperMeters: Point, pitch: PitchConfig, bodyWidth = keeperReachWidth): Point {
  const left = leftPost(pitch).x;
  const right = rightPost(pitch).x;
  const center = goalCenter(pitch);

  if (ballMeters.y <= 0.2 || keeperMeters.y >= ballMeters.y - 0.3) {
    return center;
  }

  const dx = keeperMeters.x - ballMeters.x;
  const dy = keeperMeters.y - ballMeters.y;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const perp = { x: -dy / len, y: dx / len };
  const half = bodyWidth / 2;
  const edges = [
    { x: keeperMeters.x + perp.x * half, y: keeperMeters.y + perp.y * half },
    { x: keeperMeters.x - perp.x * half, y: keeperMeters.y - perp.y * half }
  ];
  const projections = edges
    .filter((edge) => edge.y < ballMeters.y - 0.05)
    .map((edge) => {
      const t = ballMeters.y / (ballMeters.y - edge.y);
      return ballMeters.x + (edge.x - ballMeters.x) * t;
    });

  if (projections.length < 2) {
    return center;
  }

  const shadowMin = Math.max(left, Math.min(projections[0], projections[1]));
  const shadowMax = Math.min(right, Math.max(projections[0], projections[1]));

  if (shadowMax <= left || shadowMin >= right) {
    return center;
  }

  const leftGap = shadowMin - left;
  const rightGap = right - shadowMax;

  return leftGap >= rightGap ? { x: left + leftGap / 2, y: 0 } : { x: right - rightGap / 2, y: 0 };
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
