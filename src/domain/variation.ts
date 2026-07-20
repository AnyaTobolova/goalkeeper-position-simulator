import type { Level, Point } from "./types";
import { clamp } from "./geometry";

// Детерминированная вариация координат при повторных заходах в уровень,
// чтобы ребенок решал ситуацию заново, а не вспоминал картинку.
// Сдвиг общий для мяча и всех игроков: футбольный смысл эпизода сохраняется.

function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

// mulberry32: компактный детерминированный генератор [0, 1)
function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shiftPoint(point: Point, dx: number, dy: number): Point {
  return {
    x: clamp(point.x + dx, 5, 95),
    y: clamp(point.y + dy, 1.5, 62)
  };
}

// Сторона мяча не должна меняться, иначе тексты «справа/слева» станут неверными.
function clampToSameSide(x: number, originalX: number) {
  if (originalX > 54) {
    return Math.max(x, 52.5);
  }

  if (originalX < 46) {
    return Math.min(x, 47.5);
  }

  // центральный мяч остается центральным
  return clamp(x, 46.5, 53.5);
}

// Пары «правая/левая сторона» для зеркальных вариаций. Только целые слова и
// конкретные формы, чтобы не задеть «правильно», «правило», «исправить».
const mirrorPairs: [string, string][] = [
  ["справа", "слева"],
  ["Справа", "Слева"],
  ["вправо", "влево"],
  ["Вправо", "Влево"],
  ["направо", "налево"],
  ["правее", "левее"],
  ["Правее", "Левее"],
  ["правый", "левый"],
  ["Правый", "Левый"],
  ["правая", "левая"],
  ["правую", "левую"],
  ["правой", "левой"],
  ["правого", "левого"],
  ["правом", "левом"],
  ["правым", "левым"]
];

export function mirrorText(text: string): string {
  let result = text;

  mirrorPairs.forEach(([right], index) => {
    result = result.replace(new RegExp(`(?<![а-яё])${right}(?![а-яё])`, "g"), `${index}`);
  });

  mirrorPairs.forEach(([right, left], index) => {
    result = result.replace(new RegExp(`(?<![а-яё])${left}(?![а-яё])`, "g"), right);
    result = result.split(`${index}`).join(left);
  });

  return result;
}

function mirrorX(x: number) {
  return 100 - x;
}

// Полное зеркало эпизода: координаты, цель у ворот, разворот корпуса и тексты.
export function mirrorLevel(level: Level): Level {
  const swapError = (error: Level["mainErrorType"]) => (error === "TOO_LEFT" ? "TOO_RIGHT" : error === "TOO_RIGHT" ? "TOO_LEFT" : error);

  return {
    ...level,
    title: mirrorText(level.title),
    successText: mirrorText(level.successText),
    almostText: mirrorText(level.almostText),
    errorText: mirrorText(level.errorText),
    hintText: mirrorText(level.hintText),
    mainErrorType: swapError(level.mainErrorType),
    ball: { ...level.ball, x: mirrorX(level.ball.x) },
    previousBall: level.previousBall ? { ...level.previousBall, x: mirrorX(level.previousBall.x) } : undefined,
    initialGoalkeeper: { ...level.initialGoalkeeper, x: mirrorX(level.initialGoalkeeper.x) },
    initialGoalkeeperFacing: level.initialGoalkeeperFacing !== undefined ? (360 - level.initialGoalkeeperFacing) % 360 : undefined,
    goalTarget: level.goalTarget ? { ...level.goalTarget, side: -level.goalTarget.side } : undefined,
    freeKick: level.freeKick
      ? { ...level.freeKick, initialWall: { ...level.freeKick.initialWall, x: mirrorX(level.freeKick.initialWall.x) } }
      : undefined,
    players: level.players.map((player) => ({ ...player, x: mirrorX(player.x) }))
  };
}

export function applyLevelVariation(level: Level, attempt: number): Level {
  if (attempt <= 0) {
    return level;
  }

  // Пенальти бьется с точки, угловой - от флажка: их не сдвигаем.
  if (level.category === "penalty" || level.category === "corner") {
    return level;
  }

  const random = seededRandom(hashString(level.id) ^ Math.imul(attempt, 2654435761));
  // Половина повторов - зеркальная версия эпизода: тексты меняются вместе с полем.
  if (random() < 0.5) {
    level = mirrorLevel(level);
  }
  const dx = (random() - 0.5) * 6;
  const dy = (random() - 0.5) * 5;
  const shiftedBall = shiftPoint(level.ball, dx, dy);
  const ball: Point = {
    x: clampToSameSide(shiftedBall.x, level.ball.x),
    y: Math.max(3, shiftedBall.y)
  };
  const appliedDx = ball.x - level.ball.x;
  const appliedDy = ball.y - level.ball.y;

  return {
    ...level,
    ball,
    previousBall: level.previousBall ? shiftPoint(level.previousBall, appliedDx, appliedDy) : undefined,
    players: level.players.map((player) => ({
      ...player,
      ...shiftPoint(player, appliedDx, appliedDy)
    }))
  };
}
