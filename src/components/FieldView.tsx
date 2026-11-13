import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckResult, Level, OrientedZone, PitchConfig, Point, VisualHint, WallConfig, Zone } from "../domain/types";
import { fromMeters, goalCenter, leftPost, rightPost, toMeters } from "../domain/geometry";
import { openGoalSegments, openGoalSegmentsWithWall } from "../domain/openGoalSegments";
import { buildPositionZones, classifyLocalPosition, toLocal } from "../domain/positionZones";
import { shotExample } from "../domain/shotExample";

type FieldViewProps = {
  pitch: PitchConfig;
  level: Level;
  goalkeeper: Point;
  goalkeeperFacing: number;
  result: CheckResult | null;
  showDimensions: boolean;
  visualHints: VisualHint[];
  showOpenGoal: boolean;
  alternativePlayerId?: string | null;
  hideBall?: boolean;
  wall?: WallConfig;
  onGoalkeeperChange: (point: Point) => void;
  onGoalkeeperFacingChange: (angle: number) => void;
  onWallChange?: (wall: WallConfig) => void;
};

const margin = 4;
const viewBoxWidth = 100;

function yToSvg(y: number) {
  return 100 - y;
}

function zoneToRect(zone: Zone, fieldHeight: number) {
  return {
    x: zone.xMin,
    y: yToSvg(zone.yMax) * (fieldHeight / 100),
    width: zone.xMax - zone.xMin,
    height: (zone.yMax - zone.yMin) * (fieldHeight / 100)
  };
}

function formatMeters(value: number) {
  return `${Math.round(value * 10) / 10} м`;
}

function ZoneShape({ zone, className, fieldHeight }: { zone: OrientedZone; className: string; fieldHeight: number }) {
  const center = {
    x: zone.center.x,
    y: yToSvg(zone.center.y) * (fieldHeight / 100)
  };
  const depthHalf = zone.depthHalf * (fieldHeight / 100);
  const sideHalf = zone.sideHalf;
  if (depthHalf <= 0 || sideHalf <= 0) return null;

  return (
    <g transform={`translate(${center.x} ${center.y}) rotate(${zone.angle})`}>
      <rect className={className} x={-sideHalf} y={-depthHalf} width={sideHalf * 2} height={depthHalf * 2} />
    </g>
  );
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function useCompactField() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px), (pointer: coarse)");
    const update = () => setCompact(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return compact;
}

// Единая фигура футболиста (вид сверху-спереди): голова, футболка с рукавами,
// шорты, гетры и тёмные бутсы, мягкая тень. Одним размером для всех ролей —
// атака, стенка, вратарь — чтобы в сцене все были соразмерны.
// Прототип: переключатель между векторными фигурами (false) и растровыми спрайтами (true).
// Чтобы вернуться к вектору — поставить false.
const USE_SPRITES = true;
// Спрайты по ролям: вратарь и стенка смотрят на мяч (вид сзади),
// нападающие идут на ворота к камере (вид спереди).
// Детские фигуры (вратарь пока взрослый — заглушка до детского спрайта).
const SPRITE_KEEPER = "/sprites/keeper-child-stance.png";
const SPRITE_ATTACKER = "/sprites/attacker-child-red-front.png";
const SPRITE_DEFENDER = "/sprites/defender-child-blue-back.png";

function FootballerBody({ hasBall, keeper, role }: { hasBall?: boolean; keeper?: boolean; role?: "attacker" | "defender" }) {
  if (USE_SPRITES) {
    const href = keeper ? SPRITE_KEEPER : role === "defender" ? SPRITE_DEFENDER : SPRITE_ATTACKER;
    return (
      <g>
        {hasBall && <circle className="player-focus-ring" cx="0" cy="-1.9" r="1.75" />}
        {/* Спрайт 512×512: ступни ≈ на 90% высоты, центр по горизонтали.
            Ставим так, чтобы ноги попали в точку установки (0,0). */}
        <image href={href} x={-5} y={-9} width={10} height={10} preserveAspectRatio="xMidYMid meet" />
      </g>
    );
  }
  return (
    <g transform="translate(0 -3.85)">
      {hasBall && <circle className="player-focus-ring" cx="0" cy="1.95" r="1.75" />}
      <ellipse className="figure-shadow" cx="0" cy="3.95" rx="1.95" ry="0.6" />

      {/* гетры (носки) и бутсы */}
      <path className="figure-sock" d="M -0.92 1.7 L -0.28 1.7 L -0.4 3.55 L -0.96 3.55 Z" />
      <path className="figure-sock" d="M 0.28 1.7 L 0.92 1.7 L 0.96 3.55 L 0.4 3.55 Z" />
      <ellipse className="figure-boot" cx="-0.7" cy="3.72" rx="0.6" ry="0.38" />
      <ellipse className="figure-boot" cx="0.7" cy="3.72" rx="0.6" ry="0.38" />

      {/* шорты */}
      <path className="figure-shorts" d="M -1.24 0.82 L 1.24 0.82 L 1.0 2.0 L -1.0 2.0 Z" />

      {/* рукава и футболка */}
      <path className="figure-sleeve" d="M -1.46 -2.05 L -2.28 -1.2 L -1.78 -0.4 L -1.3 -1.35 Z" />
      <path className="figure-sleeve" d="M 1.46 -2.05 L 2.28 -1.2 L 1.78 -0.4 L 1.3 -1.35 Z" />
      <path className="figure-shirt" d="M -1.5 -2.2 Q 0 -2.55 1.5 -2.2 L 1.68 0.95 Q 0 1.55 -1.68 0.95 Z" />
      {/* блик сверху и тень снизу — объём */}
      <path className="figure-shirt-light" d="M -1.42 -2.1 Q 0 -2.42 1.42 -2.1 L 1.2 -0.85 Q 0 -1.18 -1.2 -0.85 Z" />
      <path className="figure-shirt-shade" d="M -1.66 0.35 Q 0 0.98 1.66 0.35 L 1.68 0.95 Q 0 1.55 -1.68 0.95 Z" />

      {keeper && (
        <>
          <circle className="keeper-glove" cx="-2.5" cy="-0.5" r="0.5" />
          <circle className="keeper-glove" cx="2.5" cy="-0.5" r="0.5" />
        </>
      )}

      {/* голова и волосы */}
      <circle className="figure-head" cx="0" cy="-3.05" r="0.84" />
      <circle className="figure-head-light" cx="-0.26" cy="-3.32" r="0.42" />
      <path className="figure-hair" d="M -0.74 -3.2 Q 0 -4.12 0.8 -3.2 Q 0.2 -3.66 -0.74 -3.2" />
    </g>
  );
}

function PlayerFigure({ x, y, role, hasBall, scale, animate }: { x: number; y: number; role: "attacker" | "defender"; hasBall?: boolean; scale: number; animate?: boolean }) {
  const className = role === "attacker" ? "figure attacker-figure" : "figure defender-figure";

  return (
    <g
      className={className}
      transform={animate ? undefined : `translate(${x} ${y}) scale(${scale})`}
      style={animate ? { transform: `translate(${x}px, ${y}px) scale(${scale})`, transition: "transform 0.9s ease-out" } : undefined}
    >
      <FootballerBody hasBall={hasBall} role={role} />
    </g>
  );
}

function GoalkeeperFigure({
  x,
  y,
  facing,
  scale,
  onDirectionPointerDown,
  onDirectionPointerMove
}: {
  x: number;
  y: number;
  facing: number;
  scale: number;
  onDirectionPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onDirectionPointerMove: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  return (
    <g className="figure goalkeeper-figure keeper-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      <g transform="translate(0 -3.85)">
        <g
          className="keeper-direction"
          transform={`translate(0 1.4) rotate(${facing}) translate(0 -1.4)`}
          onPointerDown={onDirectionPointerDown}
          onPointerMove={onDirectionPointerMove}
        >
          <circle className="keeper-direction-hit" cx="0" cy="-4.05" r="4.2" />
          <path className="keeper-facing-cone" d="M 0 -6.4 L -2.1 -2.3 L 2.1 -2.3 Z" />
          <path className="keeper-facing-mark" d="M 0 -6.05 L -0.98 -4.4 L 0.98 -4.4 Z" />
        </g>
      </g>
      <FootballerBody keeper />
    </g>
  );
}

// Стенка: ряд обычных фигур футболистов в полный размер, плечом к плечу,
// двигается целиком. Количество задаётся игроком.
function WallFigure({ x, y, count, scale }: { x: number; y: number; count: number; scale: number }) {
  const spacing = 2.55;
  const start = -((count - 1) * spacing) / 2;

  return (
    <g className="wall-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      {Array.from({ length: count }).map((_, index) => (
        <g key={index} className="figure defender-figure" transform={`translate(${start + index * spacing} 0)`}>
          <FootballerBody role="defender" />
        </g>
      ))}
    </g>
  );
}

export function FieldView({ pitch, level, goalkeeper, goalkeeperFacing, result, showDimensions, visualHints, showOpenGoal, alternativePlayerId, hideBall = false, wall, onGoalkeeperChange, onGoalkeeperFacingChange, onWallChange }: FieldViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const shotAngleClipId = useRef(`shot-angle-clip-${Math.random().toString(36).slice(2)}`).current;
  const wallDistanceMaskId = useRef(`wall-distance-mask-${Math.random().toString(36).slice(2)}`).current;
  const compactField = useCompactField();
  const fieldHeight = Math.max(64, (pitch.fieldLength / pitch.fieldWidth) * viewBoxWidth);
  const scaleX = viewBoxWidth / pitch.fieldWidth;
  const scaleY = fieldHeight / pitch.fieldLength;
  const scalePoint = (point: Point) => ({ x: point.x * scaleX, y: fieldHeight - point.y * scaleY });
  const percentToSvg = (point: Point) => ({ x: point.x, y: yToSvg(point.y) * (fieldHeight / 100) });
  const meterBall = toMeters(level.ball, pitch);
  const center = goalCenter(pitch);
  const left = leftPost(pitch);
  const right = rightPost(pitch);
  const ball = scalePoint(meterBall);
  const centerSvg = scalePoint(center);
  const leftSvg = scalePoint(left);
  const rightSvg = scalePoint(right);
  const keeperSvg = percentToSvg(goalkeeper);
  const wallSvg = wall ? percentToSvg(wall) : null;
  const optimalSvg = result ? percentToSvg(result.evaluation.optimalPoint) : null;
  const correctZone = result?.evaluation.correctOrientedZone;
  const almostZone = result?.evaluation.almostOrientedZone;
  const dangerZone = result?.evaluation.dangerOrientedZone;
  const tooDeepZone = result?.evaluation.tooDeepOrientedZone;
  const tooHighZone = result?.evaluation.tooHighOrientedZone;
  const wallRect = result?.evaluation.wallZone ? zoneToRect(result.evaluation.wallZone, fieldHeight) : null;
  const hasHint = (hint: VisualHint) => visualHints.includes(hint);
  const showShotAngle = result && hasHint("BALL_TO_GOAL_LINE");
  const openSegments = showOpenGoal && result
    ? level.freeKick && wall
      ? openGoalSegmentsWithWall(meterBall, toMeters(goalkeeper, pitch), pitch, { ...toMeters(wall, pitch), count: wall.count })
      : result.evaluation.openGoalPercent !== undefined
        ? openGoalSegments(meterBall, toMeters(goalkeeper, pitch), pitch)
        : []
    : [];
  // Пример удара независим от оценки ответа.
  const [shotProgress, setShotProgress] = useState(0);
  const shotOutcome = (() => {
    if (!result || hideBall || !result.evaluation.openShotTarget) {
      return null;
    }

    const example = shotExample(result, level, goalkeeper, pitch, wall);
    if (!example) return null;
    const { isGoal, target: exampleTarget } = example;

    if (isGoal) {
      const target = percentToSvg(exampleTarget);
      return { isGoal, target: { x: target.x, y: target.y + 2.2 } };
    }

    const toBall = { x: ball.x - keeperSvg.x, y: ball.y - keeperSvg.y };
    const toBallLen = Math.max(0.001, Math.hypot(toBall.x, toBall.y));

    return { isGoal, target: { x: keeperSvg.x + (toBall.x / toBallLen) * 1.4, y: keeperSvg.y + (toBall.y / toBallLen) * 1.4 } };
  })();

  useEffect(() => {
    setShotProgress(0);

    if (!result || !result.evaluation.openShotTarget) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShotProgress(1);
      return;
    }

    let interval = 0;
    const delay = window.setTimeout(() => {
      const startTs = Date.now();
      interval = window.setInterval(() => {
        const t = Math.min(1, (Date.now() - startTs) / 620);
        setShotProgress(t);

        if (t >= 1) {
          window.clearInterval(interval);
        }
      }, 40);
    }, 380);

    return () => {
      window.clearTimeout(delay);
      window.clearInterval(interval);
    };
  }, [result]);

  const shotEase = 1 - (1 - shotProgress) ** 2;
  const ballRender = shotOutcome ? { x: ball.x + (shotOutcome.target.x - ball.x) * shotEase, y: ball.y + (shotOutcome.target.y - ball.y) * shotEase } : ball;
  // В блоке «Реакция» игроки не стоят на месте: до появления мяча они
  // подъезжают на свои позиции, чтобы вратарь читал живую расстановку.
  const reactionLevel = level.stage === "reaction_to_ball_owner";
  const [playersEntered, setPlayersEntered] = useState(false);

  useEffect(() => {
    if (!hideBall) {
      setPlayersEntered(true);
      return;
    }

    setPlayersEntered(false);
    const enterTimer = window.setTimeout(() => setPlayersEntered(true), 140);

    return () => window.clearTimeout(enterTimer);
  }, [hideBall, level.id]);

  function playerDrift(id: string) {
    let hash = 0;

    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }

    return {
      dx: ((Math.abs(hash) % 7) - 3) * 1.8,
      dy: 4 + (Math.abs(hash >> 3) % 5) * 1.4
    };
  }
  const positionZones = result ? buildPositionZones(level, pitch) : null;
  const footStatus = result && positionZones
    ? classifyLocalPosition(toLocal(toMeters(goalkeeper, pitch), positionZones.center, positionZones.axes), positionZones.cfg, !result.evaluation.outsideShotAngle).status
    : "correct";
  const footInsideTarget = footStatus === "correct" || footStatus === "almost";
  const box = pitch.markings;
  const goalSvgX = (pitch.fieldWidth / 2 - pitch.goalWidth / 2) * scaleX;
  const goalSvgWidth = pitch.goalWidth * scaleX;
  const playerScale = compactField ? 0.92 : 0.78;
  const goalkeeperScale = compactField ? 1.02 : 0.84;
  // Глубина сетки у земли реалистична при ~0.36 от ширины ворот (а не почти в ширину).
  const goalDepth = Math.max(3, Math.min(8, goalSvgWidth * 0.36));
  const playerSvgPoints = level.players.map((player) => percentToSvg(player));
  const alternativePlayer = result && alternativePlayerId
    ? level.players.find((player) => player.id === alternativePlayerId && player.role === "attacker" && !player.hasBall)
    : undefined;
  const alternativePoint = alternativePlayer ? percentToSvg(alternativePlayer) : null;
  const markingWidths = [
    ...(box.hasGoalArea && box.goalAreaWidth ? [box.goalAreaWidth] : []),
    ...(box.hasPenaltyArea && box.penaltyAreaWidth ? [box.penaltyAreaWidth] : [])
  ];
  const markingDepths = [
    ...(box.hasGoalArea && box.goalAreaDepth ? [box.goalAreaDepth] : []),
    ...(box.hasPenaltyArea && box.penaltyAreaDepth ? [box.penaltyAreaDepth] : [])
  ];
  const importantY = [ball.y, keeperSvg.y, ...markingDepths.map((depth) => fieldHeight - depth * scaleY), ...(wallSvg ? [wallSvg.y] : []), ...playerSvgPoints.map((point) => point.y)];
  const importantX = [goalSvgX, goalSvgX + goalSvgWidth, ball.x, keeperSvg.x, ...markingWidths.flatMap((width) => [(pitch.fieldWidth / 2 - width / 2) * scaleX, (pitch.fieldWidth / 2 + width / 2) * scaleX]), ...(wallSvg ? [wallSvg.x] : []), ...playerSvgPoints.map((point) => point.x)];
  const minViewBoxWidth = compactField ? 46 : 56;
  const focusPadding = compactField ? 8 : 12;
  const rawFocusLeft = Math.min(...importantX) - focusPadding;
  const rawFocusRight = Math.max(...importantX) + focusPadding;
  const rawFocusWidth = rawFocusRight - rawFocusLeft;
  const focusWidth = Math.min(compactField && rawFocusWidth <= 84 ? 84 : viewBoxWidth, Math.max(minViewBoxWidth, rawFocusWidth));
  const focusCenterX = clamp((rawFocusLeft + rawFocusRight) / 2, focusWidth / 2, viewBoxWidth - focusWidth / 2);
  const focusLeft = focusCenterX - focusWidth / 2;
  const focusTop = Math.max(0, Math.min(...importantY) - (compactField ? 7 : 10));
  // Запас под воротами: там живет надпись исхода удара («Сейв!» / «Гол»).
  const focusBottom = fieldHeight + goalDepth + (compactField ? 7.5 : 8);
  const focusHeight = Math.max(compactField ? 36 : 42, focusBottom - focusTop);
  const viewBox = `${focusLeft - margin} ${focusTop - margin} ${focusWidth + margin * 2} ${focusHeight + margin * 2}`;

  const visiblePenalty = useMemo(() => {
    if (!box.hasPenaltyArea || !box.penaltyAreaDepth || !box.penaltyAreaWidth) {
      return null;
    }

    return {
      x: (pitch.fieldWidth / 2 - box.penaltyAreaWidth / 2) * scaleX,
      y: fieldHeight - box.penaltyAreaDepth * scaleY,
      width: box.penaltyAreaWidth * scaleX,
      height: box.penaltyAreaDepth * scaleY
    };
  }, [box, fieldHeight, pitch.fieldWidth, scaleX, scaleY]);

  function pointerToPercent(clientX: number, clientY: number) {
    const svg = svgRef.current;

    if (!svg) {
      return goalkeeper;
    }

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const converted = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const x = Math.max(8, Math.min(92, converted.x));
    const y = Math.max(-8, Math.min(55, 100 - converted.y / (fieldHeight / 100)));

    return { x, y };
  }

  function pointerToFacing(clientX: number, clientY: number) {
    const svg = svgRef.current;

    if (!svg) {
      return goalkeeperFacing;
    }

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const converted = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    return normalizeAngle((Math.atan2(converted.x - keeperSvg.x, keeperSvg.y - converted.y) * 180) / Math.PI);
  }

  function goalkeeperPointerPosition(clientX: number, clientY: number) {
    const point = pointerToPercent(clientX, clientY);
    // При пенальти помогаем пальцем поставить точку точно на линию.
    if (level.category === "penalty" && Math.abs(point.y * pitch.fieldLength / 100) <= 0.3) {
      return { ...point, y: 0 };
    }
    return point;
  }

  function handlePointerDown(event: React.PointerEvent<SVGCircleElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onGoalkeeperChange(goalkeeperPointerPosition(event.clientX, event.clientY));
  }

  function handlePointerMove(event: React.PointerEvent<SVGCircleElement>) {
    if (event.buttons !== 1 && event.pointerType !== "touch") {
      return;
    }

    onGoalkeeperChange(goalkeeperPointerPosition(event.clientX, event.clientY));
  }

  function handleRotatePointerDown(event: React.PointerEvent<SVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onGoalkeeperFacingChange(pointerToFacing(event.clientX, event.clientY));
  }

  function handleRotatePointerMove(event: React.PointerEvent<SVGElement>) {
    if (event.buttons !== 1 && event.pointerType !== "touch") {
      return;
    }

    onGoalkeeperFacingChange(pointerToFacing(event.clientX, event.clientY));
  }

  function handleWallPointerDown(event: React.PointerEvent<SVGRectElement>) {
    if (!wall || !onWallChange || result) {
      return;
    }

    const point = pointerToPercent(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    onWallChange({ ...wall, x: clamp(point.x, 10, 90), y: clamp(point.y, 1, 38) });
  }

  function handleWallPointerMove(event: React.PointerEvent<SVGRectElement>) {
    if (!wall || !onWallChange || result || (event.buttons !== 1 && event.pointerType !== "touch")) {
      return;
    }

    const point = pointerToPercent(event.clientX, event.clientY);
    onWallChange({ ...wall, x: clamp(point.x, 10, 90), y: clamp(point.y, 1, 38) });
  }

  return (
    <div className="field-shell">
      <svg ref={svgRef} className="field" viewBox={viewBox} role="img" aria-label="Футбольное поле">
        <defs>
          <linearGradient id="grass-stripe-a" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2f8d4d" />
            <stop offset="100%" stopColor="#2a844a" />
          </linearGradient>
          <linearGradient id="grass-stripe-b" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#246f3c" />
            <stop offset="100%" stopColor="#206538" />
          </linearGradient>
          <pattern id="grass" width="120" height="16" patternUnits="userSpaceOnUse">
            <rect width="120" height="16" fill="url(#grass-stripe-b)" />
            <rect width="120" height="8" fill="url(#grass-stripe-a)" />
          </pattern>
          {/* Зернистая текстура травы: мелкий фрактальный шум - тёмные и светлые
              крапинки, чтобы газон не был плоским (без картинок). */}
          <filter id="turf-dark" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.7" numOctaves="2" seed="11" stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0.9 0.9 0 -1.05" />
          </filter>
          <filter id="turf-light" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="2" numOctaves="2" seed="4" stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0.9 0.9 0 -1.1" />
          </filter>
          <linearGradient id="grass-light" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="42%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.16)" />
          </linearGradient>
          <radialGradient id="grass-vignette" cx="50%" cy="40%" r="80%">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
          </radialGradient>
          {/* Градиенты формы и кожи — объём фигур без картинок */}
          <linearGradient id="shirt-red" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ff6a63" />
            <stop offset="52%" stopColor="#e23b3b" />
            <stop offset="100%" stopColor="#b02626" />
          </linearGradient>
          <linearGradient id="shirt-blue" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#64a4ff" />
            <stop offset="52%" stopColor="#2f6df6" />
            <stop offset="100%" stopColor="#1c4bbd" />
          </linearGradient>
          <linearGradient id="shirt-yellow" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe579" />
            <stop offset="52%" stopColor="#ffcf33" />
            <stop offset="100%" stopColor="#e0a21c" />
          </linearGradient>
          <linearGradient id="shorts-white" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d4dcea" />
          </linearGradient>
          <radialGradient id="skin-shade" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#ffe9d2" />
            <stop offset="100%" stopColor="#e9bd97" />
          </radialGradient>
          <filter id="figure-soft-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" floodColor="#000000" floodOpacity="0.5" />
          </filter>
          <pattern id="goal-net-pattern" width="1.3" height="1.15" patternUnits="userSpaceOnUse">
            <path d="M 0.65 0 L 1.3 0.29 L 1.3 0.86 L 0.65 1.15 L 0 0.86 L 0 0.29 Z" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.12" />
          </pattern>
          <linearGradient id="goal-frame-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f6faf5" />
            <stop offset="100%" stopColor="#e4eae2" />
          </linearGradient>
          {/* глубина ворот: лёгкая тень у линии, темнее к задней стенке */}
          <linearGradient id="goal-interior" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#0a140e" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#050a07" stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="ball-shade" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="62%" stopColor="#f4f4ec" />
            <stop offset="100%" stopColor="#cfcfc5" />
          </radialGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth={compactField ? 3.2 : 2.9} markerHeight={compactField ? 3.2 : 2.9} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M 0 1.4 L 9.4 5 L 0 8.6 z" fill="#5bd2ff" />
          </marker>
          <clipPath id={shotAngleClipId} clipPathUnits="userSpaceOnUse">
            <polygon points={`${ball.x},${ball.y} ${leftSvg.x},${leftSvg.y} ${rightSvg.x},${rightSvg.y}`} />
          </clipPath>
          <mask id={wallDistanceMaskId} maskUnits="userSpaceOnUse" x="0" y="0" width={viewBoxWidth} height={fieldHeight}>
            <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} fill="white" />
            <ellipse cx={ball.x} cy={ball.y} rx={(pitch.freeKickDistance ?? pitch.markings.penaltyArcRadius ?? 9.15) * scaleX} ry={(pitch.freeKickDistance ?? pitch.markings.penaltyArcRadius ?? 9.15) * scaleY} fill="black" />
          </mask>
        </defs>

        <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} rx="1" fill="url(#grass)" />
        <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} rx="1" fill="#000" filter="url(#turf-dark)" opacity="0.16" />
        <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} rx="1" fill="#fff" filter="url(#turf-light)" opacity="0.1" />
        <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} rx="1" fill="url(#grass-light)" />
        <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} rx="1" fill="url(#grass-vignette)" />
        <rect className="line" x="0" y="0" width={viewBoxWidth} height={fieldHeight} />
        <line className="line muted" x1="0" y1={fieldHeight / 2} x2={viewBoxWidth} y2={fieldHeight / 2} />
        <circle className="line muted" cx={viewBoxWidth / 2} cy={fieldHeight / 2} r={(box.centerCircleRadius ?? 7) * scaleX} />
        <circle className="spot" cx={viewBoxWidth / 2} cy={fieldHeight / 2} r="0.55" />

        {visiblePenalty && <rect className="line" {...visiblePenalty} />}

        {box.hasGoalArea && box.goalAreaDepth && box.goalAreaWidth && (
          <rect
            className="line"
            x={(pitch.fieldWidth / 2 - box.goalAreaWidth / 2) * scaleX}
            y={fieldHeight - box.goalAreaDepth * scaleY}
            width={box.goalAreaWidth * scaleX}
            height={box.goalAreaDepth * scaleY}
          />
        )}

        {box.hasPenaltySpot && box.penaltySpotDistance && (
          <circle className="spot" cx={viewBoxWidth / 2} cy={fieldHeight - box.penaltySpotDistance * scaleY} r="0.5" />
        )}

        {box.hasPenaltyArc && box.penaltySpotDistance && box.penaltyArcRadius && box.penaltyAreaDepth && (
          <path
            className="line muted"
            d={`M ${
              viewBoxWidth / 2 - Math.sqrt(Math.max(0, box.penaltyArcRadius ** 2 - (box.penaltyAreaDepth - box.penaltySpotDistance) ** 2)) * scaleX
            } ${fieldHeight - box.penaltyAreaDepth * scaleY}
              Q ${viewBoxWidth / 2} ${fieldHeight - (box.penaltySpotDistance + box.penaltyArcRadius) * scaleY} ${
                viewBoxWidth / 2 + Math.sqrt(Math.max(0, box.penaltyArcRadius ** 2 - (box.penaltyAreaDepth - box.penaltySpotDistance) ** 2)) * scaleX
              } ${fieldHeight - box.penaltyAreaDepth * scaleY}`}
          />
        )}

        {box.hasCornerArcs && box.cornerArcRadius && (
          <>
            <path className="line muted" d={`M 0 ${fieldHeight - box.cornerArcRadius * scaleY} A ${box.cornerArcRadius * scaleX} ${box.cornerArcRadius * scaleY} 0 0 0 ${box.cornerArcRadius * scaleX} ${fieldHeight}`} />
            <path className="line muted" d={`M ${viewBoxWidth - box.cornerArcRadius * scaleX} ${fieldHeight} A ${box.cornerArcRadius * scaleX} ${box.cornerArcRadius * scaleY} 0 0 0 ${viewBoxWidth} ${fieldHeight - box.cornerArcRadius * scaleY}`} />
          </>
        )}

        <rect className="goal-apron" x="0" y={fieldHeight} width={viewBoxWidth} height={goalDepth + 6} fill="url(#grass)" />

        <g className="goal-3d">
          <path
            className="goal-shadow"
            d={`M ${goalSvgX - 1.2} ${fieldHeight + 0.8} L ${goalSvgX + goalSvgWidth + 1.2} ${fieldHeight + 0.8} L ${goalSvgX + goalSvgWidth - 0.4} ${
              fieldHeight + goalDepth + 0.9
            } L ${goalSvgX + 0.4} ${fieldHeight + goalDepth + 0.9} Z`}
          />
          <path
            className="goal-mouth"
            d={`M ${goalSvgX} ${fieldHeight} L ${goalSvgX + goalSvgWidth} ${fieldHeight} L ${goalSvgX + goalSvgWidth - 1.55} ${
              fieldHeight + goalDepth
            } L ${goalSvgX + 1.55} ${fieldHeight + goalDepth} Z`}
          />
          <path
            className="goal-net"
            d={`M ${goalSvgX + 0.8} ${fieldHeight + 0.7} L ${goalSvgX + goalSvgWidth - 0.8} ${fieldHeight + 0.7} L ${
              goalSvgX + goalSvgWidth - 1.8
            } ${fieldHeight + goalDepth - 0.7} L ${goalSvgX + 1.8} ${fieldHeight + goalDepth - 0.7} Z`}
          />
          <line className="goal-line-strong" x1={goalSvgX - 3} y1={fieldHeight} x2={goalSvgX + goalSvgWidth + 3} y2={fieldHeight} />
          <line className="goal-backbar" x1={goalSvgX + 1.55} y1={fieldHeight + goalDepth} x2={goalSvgX + goalSvgWidth - 1.55} y2={fieldHeight + goalDepth} />
          <line className="goal-side-net" x1={goalSvgX} y1={fieldHeight} x2={goalSvgX + 1.55} y2={fieldHeight + goalDepth} />
          <line className="goal-side-net" x1={goalSvgX + goalSvgWidth} y1={fieldHeight} x2={goalSvgX + goalSvgWidth - 1.55} y2={fieldHeight + goalDepth} />
          <path className="goal-support left" d={`M ${goalSvgX + 1.55} ${fieldHeight + goalDepth} L ${goalSvgX - 1.9} ${fieldHeight + goalDepth + 2.4}`} />
          <path className="goal-support right" d={`M ${goalSvgX + goalSvgWidth - 1.55} ${fieldHeight + goalDepth} L ${goalSvgX + goalSvgWidth + 1.9} ${fieldHeight + goalDepth + 2.4}`} />
          <line className="goal-front-frame" x1={goalSvgX} y1={fieldHeight} x2={goalSvgX + goalSvgWidth} y2={fieldHeight} />
          <line className="goal-post" x1={goalSvgX} y1={fieldHeight} x2={goalSvgX + 1.55} y2={fieldHeight + goalDepth} />
          <line className="goal-post" x1={goalSvgX + goalSvgWidth} y1={fieldHeight} x2={goalSvgX + goalSvgWidth - 1.55} y2={fieldHeight + goalDepth} />
          <circle className="goal-post-cap" cx={goalSvgX} cy={fieldHeight} r="0.72" />
          <circle className="goal-post-cap" cx={goalSvgX + goalSvgWidth} cy={fieldHeight} r="0.72" />
        </g>

        {openSegments.map(([start, end], index) => (
          <line key={index} className="open-goal-segment" x1={start * scaleX} x2={end * scaleX} y1={fieldHeight} y2={fieldHeight} />
        ))}

        {result && (
          <>
            {alternativePoint && (
              <g className="alternative-shot-lines">
                <line x1={alternativePoint.x} y1={alternativePoint.y} x2={leftSvg.x} y2={leftSvg.y} />
                <line x1={alternativePoint.x} y1={alternativePoint.y} x2={rightSvg.x} y2={rightSvg.y} />
                <circle cx={alternativePoint.x} cy={alternativePoint.y} r="1.3" />
              </g>
            )}
            {showShotAngle && <polygon className="shot-angle" points={`${ball.x},${ball.y} ${leftSvg.x},${leftSvg.y} ${rightSvg.x},${rightSvg.y}`} />}
            {hasHint("BALL_TO_GOAL_LINE") && <line className="analysis-line" x1={ball.x} y1={ball.y} x2={centerSvg.x} y2={centerSvg.y} />}
            {showShotAngle && (
              <>
                <line className="trajectory shot-boundary" x1={ball.x} y1={ball.y} x2={leftSvg.x} y2={leftSvg.y} />
                <line className="trajectory shot-boundary" x1={ball.x} y1={ball.y} x2={rightSvg.x} y2={rightSvg.y} />
              </>
            )}
            {/* Клип по треугольнику угла удара - только для прямых ударов.
                На угловых и навесах он вырождается в тонкий серп у флажка
                и «смазывает» зоны, поэтому там зоны рисуются без обрезки. */}
            <g clipPath={showShotAngle ? `url(#${shotAngleClipId})` : undefined}>
              {hasHint("TOO_DEEP_ZONE") && tooDeepZone && <ZoneShape zone={tooDeepZone} className={`danger-zone ${dangerZone === tooDeepZone ? "active" : ""}`} fieldHeight={fieldHeight} />}
              {hasHint("TOO_HIGH_ZONE") && tooHighZone && <ZoneShape zone={tooHighZone} className={`danger-zone ${dangerZone === tooHighZone ? "active" : ""}`} fieldHeight={fieldHeight} />}
              {hasHint("ALMOST_ZONE") && almostZone && <ZoneShape zone={almostZone} className="almost-zone" fieldHeight={fieldHeight} />}
              {hasHint("CORRECT_ZONE") && optimalSvg && correctZone && <ZoneShape zone={correctZone} className="correct-zone" fieldHeight={fieldHeight} />}
            </g>
            {hasHint("MOVE_ARROW") && optimalSvg && (
              <>
                <line className="move-arrow" x1={keeperSvg.x} y1={keeperSvg.y} x2={optimalSvg.x} y2={optimalSvg.y} markerEnd="url(#arrow)" />
                <circle className="target-foot-point" cx={optimalSvg.x} cy={optimalSvg.y} r={compactField ? 1.25 : 0.95} />
              </>
            )}
            {hasHint("BALL_VISIBILITY_LINE") && (
              <line className={result.errorType === "NO_BALL_VISIBILITY" || result.evaluation.mainErrorType === "NO_BALL_VISIBILITY" ? "visibility-line blocked" : "visibility-line"} x1={keeperSvg.x} y1={keeperSvg.y} x2={ball.x} y2={ball.y} />
            )}
            {hasHint("BALL_MOVEMENT_PATH") && level.previousBall && (
              <line
                className="trajectory pass"
                x1={percentToSvg(level.previousBall).x}
                y1={percentToSvg(level.previousBall).y}
                x2={percentToSvg(level.ball).x}
                y2={percentToSvg(level.ball).y}
              />
            )}
            {hasHint("WALL_COVERAGE") && wallRect && <rect className="wall-target-zone" {...wallRect} mask={`url(#${wallDistanceMaskId})`} />}
          </>
        )}

        {result && hasHint("PREVIOUS_BALL_POINT") && level.previousBall && (
          <circle className="old-ball" cx={percentToSvg(level.previousBall).x} cy={percentToSvg(level.previousBall).y} r="1.35" />
        )}

        {level.players.map((player) => {
          const p = percentToSvg(player);
          const entering = reactionLevel && hideBall && !playersEntered;
          const drift = entering ? playerDrift(player.id) : null;

          return (
            <PlayerFigure
              key={player.id}
              x={p.x + (drift?.dx ?? 0)}
              y={p.y - (drift?.dy ?? 0)}
              role={player.role}
              hasBall={player.hasBall}
              scale={playerScale}
              animate={reactionLevel}
            />
          );
        })}

        {wall && wall.count > 0 && wallSvg && (
          <>
            <rect
              className="wall-hit"
              x={wallSvg.x - ((wall.count - 1) * 2.55 / 2 + 2.6) * playerScale}
              y={wallSvg.y - 8.4 * playerScale}
              width={((wall.count - 1) * 2.55 + 5.2) * playerScale}
              height={9.2 * playerScale}
              rx="2"
              onPointerDown={handleWallPointerDown}
              onPointerMove={handleWallPointerMove}
            />
            <WallFigure x={wallSvg.x} y={wallSvg.y} count={wall.count} scale={playerScale} />
          </>
        )}

        {shotOutcome && shotProgress > 0 && (
          <line className={`shot-trail ${shotOutcome.isGoal ? "goal" : "save"}`} x1={ball.x} y1={ball.y} x2={ballRender.x} y2={ballRender.y} />
        )}

        {!hideBall && (
          <g className="ball" transform={`translate(${ballRender.x} ${ballRender.y}) scale(${compactField ? 0.68 : 0.6})`}>
            <circle className="ball-base" cx="0" cy="0" r="1.28" />
            <path className="ball-patch" d="M 0 -0.7 L 0.66 -0.2 L 0.42 0.6 L -0.42 0.6 L -0.66 -0.2 Z" />
            <path className="ball-stitch" d="M 0 -0.7 L 0 -1.2 M 0.66 -0.2 L 1.16 -0.38 M 0.42 0.6 L 0.74 1.04 M -0.42 0.6 L -0.74 1.04 M -0.66 -0.2 L -1.16 -0.38" />
          </g>
        )}


        <circle
          className="goalkeeper-hit"
          cx={keeperSvg.x}
          cy={keeperSvg.y}
          r={compactField ? 6.6 : 4.8}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />
        <GoalkeeperFigure
          x={keeperSvg.x}
          y={keeperSvg.y}
          facing={goalkeeperFacing}
          scale={goalkeeperScale}
          onDirectionPointerDown={handleRotatePointerDown}
          onDirectionPointerMove={handleRotatePointerMove}
        />
        <circle className={footInsideTarget ? "keeper-foot-point" : "keeper-foot-point miss"} cx={keeperSvg.x} cy={keeperSvg.y} r={compactField ? 0.82 : 0.66} />

        {showDimensions && (
          <g className="dimensions">
            <text x="1" y="-1.2">
              {formatMeters(pitch.fieldWidth)}
            </text>
            <text x={viewBoxWidth + 1} y={fieldHeight / 2}>
              {formatMeters(pitch.fieldLength)}
            </text>
            <text x={goalSvgX + goalSvgWidth / 2 - 4} y={fieldHeight + 6}>
              ворота {formatMeters(pitch.goalWidth)} x {formatMeters(pitch.goalHeight)}
            </text>
            {result && optimalSvg && (
              <text x={Math.min(80, optimalSvg.x + 2)} y={Math.max(8, optimalSvg.y - 2)}>
                до точки {formatMeters(Math.hypot(optimalSvg.x - keeperSvg.x, optimalSvg.y - keeperSvg.y) * (pitch.fieldWidth / 100))}
              </text>
            )}
          </g>
        )}

        {shotOutcome &&
          shotProgress >= 1 &&
          (() => {
            // Надпись живет под воротами, за пределами поля - там она ничего не закрывает.
            const labelText = shotOutcome.isGoal ? "Гол" : "Сейв";
            const labelWidth = 20;
            const labelX = Math.min(
              Math.max(goalSvgX + goalSvgWidth / 2, focusLeft + labelWidth / 2 + 1),
              focusLeft + focusWidth - labelWidth / 2 - 1
            );
            const labelY = fieldHeight + goalDepth + 3.6;

            return (
              <g className={`shot-label-group ${shotOutcome.isGoal ? "goal" : "save"}`}>
                <rect x={labelX - labelWidth / 2} y={labelY - 4.8} width={labelWidth} height={6} rx="1.8" />
                <text x={labelX} y={labelY - 0.8} textAnchor="middle">{labelText}</text>
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
