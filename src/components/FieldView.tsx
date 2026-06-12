import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckResult, Level, OrientedZone, PitchConfig, Point, VisualHint, WallConfig, Zone } from "../domain/types";
import { fromMeters, goalCenter, leftPost, rightPost, toMeters } from "../domain/geometry";

type FieldViewProps = {
  pitch: PitchConfig;
  level: Level;
  goalkeeper: Point;
  goalkeeperFacing: number;
  result: CheckResult | null;
  showAnalysis: boolean;
  showDimensions: boolean;
  visualHints: VisualHint[];
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

function ZoneCapsule({ zone, className, fieldHeight }: { zone: OrientedZone; className: string; fieldHeight: number }) {
  const center = {
    x: zone.center.x,
    y: yToSvg(zone.center.y) * (fieldHeight / 100)
  };
  const depthHalf = Math.max(1.2, zone.depthHalf * (fieldHeight / 100));
  const sideHalf = Math.max(0.9, zone.sideHalf);

  return (
    <g transform={`translate(${center.x} ${center.y}) rotate(${zone.angle})`}>
      <rect className={className} x={-sideHalf} y={-depthHalf} width={sideHalf * 2} height={depthHalf * 2} rx={sideHalf} ry={sideHalf} />
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

function PlayerFigure({ x, y, role, hasBall, scale }: { x: number; y: number; role: "attacker" | "defender"; hasBall?: boolean; scale: number }) {
  const className = role === "attacker" ? "figure attacker-figure" : "figure defender-figure";

  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${scale})`}>
      <g transform="translate(0 -3.85)">
        {hasBall && <circle className="player-focus-ring" cx="0" cy="1.9" r="1.55" />}
        <ellipse className="figure-shadow" cx="0" cy="3.8" rx="1.75" ry="0.55" />
        <circle className="figure-head" cx="0" cy="-3.1" r="0.72" />
        <path className="figure-hair" d="M -0.65 -3.25 Q 0 -4.05 0.72 -3.25 Q 0.18 -3.55 -0.65 -3.25" />
        <path className="figure-shirt" d="M -1.35 -2.15 L 1.35 -2.15 L 1.65 0.75 Q 0 1.35 -1.65 0.75 Z" />
        <path className="figure-sleeve" d="M -1.35 -1.95 L -2.25 -0.55" />
        <path className="figure-sleeve" d="M 1.35 -1.95 L 2.25 -0.55" />
        <path className="figure-shorts" d="M -1.2 0.95 L 1.2 0.95 L 0.82 2.05 L -0.82 2.05 Z" />
        <path className="figure-sock" d="M -0.62 2 L -1.05 3.8" />
        <path className="figure-sock" d="M 0.62 2 L 1.05 3.8" />
      </g>
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
    <g className="goalkeeper-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      <g transform="translate(0 -3.85)">
        <ellipse className="figure-shadow" cx="0" cy="3.9" rx="1.9" ry="0.55" />
        <g
          className="keeper-direction"
          transform={`translate(0 1.4) rotate(${facing}) translate(0 -1.4)`}
          onPointerDown={onDirectionPointerDown}
          onPointerMove={onDirectionPointerMove}
        >
          <circle className="keeper-direction-hit" cx="0" cy="-4.05" r="4.2" />
          <path className="keeper-facing-cone" d="M 0 -6.15 L -2 -2.25 L 2 -2.25 Z" />
          <path className="keeper-facing-mark" d="M 0 -5.85 L -0.92 -4.35 L 0.92 -4.35 Z" />
        </g>
        <circle className="figure-head" cx="0" cy="-3.25" r="0.78" />
        <path className="figure-hair" d="M -0.7 -3.3 Q 0 -4.08 0.76 -3.3 Q 0.2 -3.6 -0.7 -3.3" />
        <path className="keeper-shirt" d="M -1.45 -2.2 L 1.45 -2.2 L 1.72 0.8 Q 0 1.42 -1.72 0.8 Z" />
        <path className="keeper-arm" d="M -1.42 -1.85 L -2.65 -0.2" />
        <path className="keeper-arm" d="M 1.42 -1.85 L 2.65 -0.2" />
        <path className="keeper-shorts" d="M -1.18 0.95 L 1.18 0.95 L 0.8 2.1 L -0.8 2.1 Z" />
        <path className="keeper-leg" d="M -0.58 2 L -1.1 3.85" />
        <path className="keeper-leg" d="M 0.58 2 L 1.1 3.85" />
        <circle className="keeper-glove" cx="-2.75" cy="-0.05" r="0.42" />
        <circle className="keeper-glove" cx="2.75" cy="-0.05" r="0.42" />
      </g>
    </g>
  );
}

function WallFigure({ x, y, count, scale }: { x: number; y: number; count: number; scale: number }) {
  const spacing = 1.65;
  const start = -((count - 1) * spacing) / 2;

  return (
    <g className="wall-figure" transform={`translate(${x} ${y}) scale(${scale})`}>
      {Array.from({ length: count }).map((_, index) => {
        const playerX = start + index * spacing;

        return (
          <g key={index} className="wall-player" transform={`translate(${playerX} 0)`}>
            <ellipse className="figure-shadow" cx="0" cy="1.5" rx="1" ry="0.32" />
            <circle className="figure-head" cx="0" cy="-2.65" r="0.56" />
            <path className="wall-shirt" d="M -0.95 -1.9 L 0.95 -1.9 L 1.12 0.2 Q 0 0.72 -1.12 0.2 Z" />
            <path className="wall-arm" d="M -0.9 -1.45 L -1.45 -0.15" />
            <path className="wall-arm" d="M 0.9 -1.45 L 1.45 -0.15" />
            <path className="wall-leg" d="M -0.35 0.45 L -0.65 1.55" />
            <path className="wall-leg" d="M 0.35 0.45 L 0.65 1.55" />
          </g>
        );
      })}
    </g>
  );
}

export function FieldView({ pitch, level, goalkeeper, goalkeeperFacing, result, showAnalysis, showDimensions, visualHints, wall, onGoalkeeperChange, onGoalkeeperFacingChange, onWallChange }: FieldViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const shotAngleClipId = useRef(`shot-angle-clip-${Math.random().toString(36).slice(2)}`).current;
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
  const footInsideTarget = result ? result.result === "correct" : true;
  const box = pitch.markings;
  const goalSvgX = (pitch.fieldWidth / 2 - pitch.goalWidth / 2) * scaleX;
  const goalSvgWidth = pitch.goalWidth * scaleX;
  const playerScale = compactField ? 0.92 : 0.78;
  const goalkeeperScale = compactField ? 1.02 : 0.84;
  const wallScale = compactField ? 0.78 : 0.66;
  const goalDepth = Math.max(compactField ? 7.2 : 5.8, Math.min(compactField ? 10.5 : 9, goalSvgWidth * (compactField ? 0.88 : 0.72)));
  const playerSvgPoints = level.players.map((player) => percentToSvg(player));
  const importantY = [ball.y, keeperSvg.y, ...(wallSvg ? [wallSvg.y] : []), ...playerSvgPoints.map((point) => point.y)];
  const importantX = [goalSvgX, goalSvgX + goalSvgWidth, ball.x, keeperSvg.x, ...(wallSvg ? [wallSvg.x] : []), ...playerSvgPoints.map((point) => point.x)];
  const minViewBoxWidth = compactField ? 46 : 56;
  const focusPadding = compactField ? 8 : 12;
  const rawFocusLeft = Math.min(...importantX) - focusPadding;
  const rawFocusRight = Math.max(...importantX) + focusPadding;
  const rawFocusWidth = rawFocusRight - rawFocusLeft;
  const focusWidth = Math.min(compactField && rawFocusWidth <= 84 ? 84 : viewBoxWidth, Math.max(minViewBoxWidth, rawFocusWidth));
  const focusCenterX = clamp((rawFocusLeft + rawFocusRight) / 2, focusWidth / 2, viewBoxWidth - focusWidth / 2);
  const focusLeft = focusCenterX - focusWidth / 2;
  const focusTop = Math.max(0, Math.min(...importantY) - (compactField ? 7 : 10));
  const focusBottom = fieldHeight + goalDepth + (compactField ? 3 : 6);
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

  function handlePointerDown(event: React.PointerEvent<SVGCircleElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    onGoalkeeperChange(pointerToPercent(event.clientX, event.clientY));
  }

  function handlePointerMove(event: React.PointerEvent<SVGCircleElement>) {
    if (event.buttons !== 1 && event.pointerType !== "touch") {
      return;
    }

    onGoalkeeperChange(pointerToPercent(event.clientX, event.clientY));
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
          <pattern id="grass" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#116b3b" />
            <rect width="10" height="5" fill="#147643" />
          </pattern>
          <pattern id="goal-net-pattern" width="2" height="1.75" patternUnits="userSpaceOnUse">
            <path d="M 1 0 L 2 0.44 L 2 1.31 L 1 1.75 L 0 1.31 L 0 0.44 Z" fill="none" stroke="rgba(255,255,255,0.48)" strokeWidth="0.16" />
          </pattern>
          <linearGradient id="goal-frame-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f3f7f1" />
            <stop offset="100%" stopColor="#cbd4ca" />
          </linearGradient>
          <radialGradient id="ball-shade" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="62%" stopColor="#f4f4ec" />
            <stop offset="100%" stopColor="#cfcfc5" />
          </radialGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth={compactField ? 7 : 6} markerHeight={compactField ? 7 : 6} orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f6c453" />
          </marker>
          <clipPath id={shotAngleClipId} clipPathUnits="userSpaceOnUse">
            <polygon points={`${ball.x},${ball.y} ${leftSvg.x},${leftSvg.y} ${rightSvg.x},${rightSvg.y}`} />
          </clipPath>
        </defs>

        <rect x="0" y="0" width={viewBoxWidth} height={fieldHeight} rx="1" fill="url(#grass)" />
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

        {result && (
          <>
            {showShotAngle && <polygon className="shot-angle" points={`${ball.x},${ball.y} ${leftSvg.x},${leftSvg.y} ${rightSvg.x},${rightSvg.y}`} />}
            {hasHint("BALL_TO_GOAL_LINE") && <line className="analysis-line" x1={ball.x} y1={ball.y} x2={centerSvg.x} y2={centerSvg.y} />}
            {showShotAngle && (
              <>
                <line className="trajectory shot-boundary" x1={ball.x} y1={ball.y} x2={leftSvg.x} y2={leftSvg.y} />
                <line className="trajectory shot-boundary" x1={ball.x} y1={ball.y} x2={rightSvg.x} y2={rightSvg.y} />
              </>
            )}
            <g clipPath={`url(#${shotAngleClipId})`}>
              {showAnalysis && hasHint("TOO_DEEP_ZONE") && tooDeepZone && <ZoneCapsule zone={tooDeepZone} className={`danger-zone ${dangerZone === tooDeepZone ? "active" : ""}`} fieldHeight={fieldHeight} />}
              {showAnalysis && hasHint("TOO_HIGH_ZONE") && tooHighZone && <ZoneCapsule zone={tooHighZone} className={`danger-zone ${dangerZone === tooHighZone ? "active" : ""}`} fieldHeight={fieldHeight} />}
              {hasHint("ALMOST_ZONE") && almostZone && <ZoneCapsule zone={almostZone} className="almost-zone" fieldHeight={fieldHeight} />}
              {hasHint("CORRECT_ZONE") && optimalSvg && correctZone && <ZoneCapsule zone={correctZone} className="correct-zone" fieldHeight={fieldHeight} />}
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
            {hasHint("CROSS_TRAJECTORY") && (
              <path className="trajectory cross" d={`M ${ball.x} ${ball.y} Q ${(ball.x + centerSvg.x) / 2} ${Math.min(ball.y, centerSvg.y) - 12} ${centerSvg.x} ${centerSvg.y}`} />
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
            {hasHint("WALL_COVERAGE") && wallRect && <rect className="wall-target-zone" {...wallRect} />}
          </>
        )}

        {result && hasHint("PREVIOUS_BALL_POINT") && level.previousBall && (
          <circle className="old-ball" cx={percentToSvg(level.previousBall).x} cy={percentToSvg(level.previousBall).y} r="1.35" />
        )}

        {level.players.map((player) => {
          const p = percentToSvg(player);
          return <PlayerFigure key={player.id} x={p.x} y={p.y} role={player.role} hasBall={player.hasBall} scale={playerScale} />;
        })}

        {wall && wall.count > 0 && wallSvg && (
          <>
            <rect
              className="wall-hit"
              x={wallSvg.x - Math.max(4.5, wall.count * 1.4)}
              y={wallSvg.y - 4.4}
              width={Math.max(9, wall.count * 2.8)}
              height="8"
              rx="2"
              onPointerDown={handleWallPointerDown}
              onPointerMove={handleWallPointerMove}
            />
            <WallFigure x={wallSvg.x} y={wallSvg.y} count={wall.count} scale={wallScale} />
          </>
        )}

        <g className="ball" transform={`translate(${ball.x} ${ball.y}) scale(${compactField ? 1.18 : 1})`}>
          <circle className="ball-base" cx="0" cy="0" r="1.28" />
          <path className="ball-patch" d="M 0 -0.7 L 0.66 -0.2 L 0.42 0.6 L -0.42 0.6 L -0.66 -0.2 Z" />
          <path className="ball-stitch" d="M 0 -0.7 L 0 -1.2 M 0.66 -0.2 L 1.16 -0.38 M 0.42 0.6 L 0.74 1.04 M -0.42 0.6 L -0.74 1.04 M -0.66 -0.2 L -1.16 -0.38" />
        </g>

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
      </svg>
    </div>
  );
}
