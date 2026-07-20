export type Unit = "meters" | "yards";

export type PitchPresetId = "5v5" | "7v7" | "8v8" | "9v9" | "11v11" | "futsal" | "custom";

export type GoalPresetId = "mini_3x2" | "junior_5x2" | "adult_732x244" | "custom";

export type LevelCategory =
  | "shot_angle"
  | "depth"
  | "one_v_one"
  | "defender_pressure"
  | "pass_reposition"
  | "reaction"
  | "cross"
  | "corner"
  | "free_kick"
  | "penalty";

export type TrainingStage = "base_position" | "reaction_to_ball_owner";

export type TrainingMode = TrainingStage;

export type ReactionDifficulty = "easy" | "medium" | "hard";

export type ReactionTimeSeconds = 5 | 4 | 3;

export type ScenarioType =
  | "central_shot"
  | "side_shot"
  | "sharp_angle"
  | "long_shot"
  | "close_shot"
  | "one_v_one"
  | "one_v_one_loose_touch"
  | "pass_or_cutback"
  | "cross_goal"
  | "high_cross"
  | "corner"
  | "free_kick"
  | "penalty"
  | "defender_pressure"
  | "sweeper_position"
  | "reaction_to_ball_owner";

export type ErrorType =
  | "TOO_CENTRAL"
  | "TOO_LEFT"
  | "TOO_RIGHT"
  | "TOO_DEEP"
  | "TOO_HIGH"
  | "NEAR_POST_OPEN"
  | "OVERPROTECTS_NEAR_POST"
  | "PASSIVE_1V1"
  | "RUSHED_1V1"
  | "IGNORED_DEFENDER"
  | "NOT_ADJUSTED_AFTER_PASS"
  | "STUCK_NEAR_POST"
  | "WRONG_BODY_ANGLE"
  | "NO_BALL_VISIBILITY"
  | "WALL_COUNT_WRONG"
  | "WALL_POSITION_WRONG"
  | "TOO_LATE_REACTION"
  | "WRONG_BALL_OWNER"
  | "WRONG_POSITION"
  | "ALMOST";

export type ResultKind = "correct" | "almost" | "wrong" | "dangerous";

export type VisualHint =
  | "BALL_TO_GOAL_LINE"
  | "CURRENT_BALL_POINT"
  | "PREVIOUS_BALL_POINT"
  | "BALL_MOVEMENT_PATH"
  | "CORRECT_ZONE"
  | "ALMOST_ZONE"
  | "TOO_HIGH_ZONE"
  | "TOO_DEEP_ZONE"
  | "NEAR_POST_SECTOR"
  | "FAR_POST_SECTOR"
  | "MOVE_ARROW"
  | "WALL_COVERAGE"
  | "BALL_VISIBILITY_LINE"
  | "DEFENDER_COVERAGE"
  | "CROSS_TRAJECTORY";

export type Point = {
  x: number;
  y: number;
};

export type Zone = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type WallConfig = {
  count: number;
  x: number;
  y: number;
};

export type ZoneConfig = {
  idealDepth: number;
  correctDepthHalf: number;
  correctSideHalf: number;
  backSlack: number;
  forwardSlack: number;
  sideSlack: number;
};

export type OrientedZone = {
  center: Point;
  depthHalf: number;
  sideHalf: number;
  angle: number;
};

export type FieldMarkings = {
  lineWidth: number;
  hasHalfwayLine: boolean;
  hasCenterSpot: boolean;
  centerCircleRadius?: number;
  hasPenaltyArea: boolean;
  penaltyAreaDepth?: number;
  penaltyAreaWidth?: number;
  hasGoalArea: boolean;
  goalAreaDepth?: number;
  goalAreaWidth?: number;
  hasPenaltySpot: boolean;
  penaltySpotDistance?: number;
  hasPenaltyArc: boolean;
  penaltyArcRadius?: number;
  hasCornerArcs: boolean;
  cornerArcRadius?: number;
};

export type PitchConfig = {
  presetId: PitchPresetId;
  goalPresetId: GoalPresetId;
  name: string;
  unit: Unit;
  fieldLength: number;
  fieldWidth: number;
  goalWidth: number;
  goalHeight: number;
  markings: FieldMarkings;
};

export type Player = {
  id: string;
  role: "attacker" | "defender";
  x: number;
  y: number;
  hasBall?: boolean;
  label?: string;
};

export type ExplanationLayers = {
  showShotAngle: boolean;
  showBallLine: boolean;
  showNearPost: boolean;
  showSuggestedMove: boolean;
  showShotTrajectories?: boolean;
  showPassTrajectory?: boolean;
  showDistances?: boolean;
};

export type Level = {
  id: string;
  title: string;
  stage?: TrainingStage;
  category: LevelCategory;
  scenarioType?: ScenarioType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  reactionDifficulty?: ReactionDifficulty;
  reactionTimeSeconds?: ReactionTimeSeconds;
  ballOwnerActivationDelayMs?: number;
  activatedBallOwnerId?: string;
  // Пас во время отсчета: когда осталось atRemainingSeconds, мяч уходит
  // к игроку toPlayerId, и вратарь перестраивается за оставшееся время.
  reactionPass?: {
    toPlayerId: string;
    atRemainingSeconds: number;
  };
  // Решение на подаче: правильный выбор «выйти на мяч» или «остаться в воротах».
  // Неверное решение снижает результат даже при хорошей точке ног.
  exitDecision?: "go" | "stay";
  ball: Point;
  previousBall?: Point;
  players: Player[];
  initialGoalkeeper: Point;
  initialGoalkeeperFacing?: number;
  correctZone?: Zone;
  almostZone?: Zone;
  // Цель для стандартов (угловой, навес, штрафной, пенальти) в координатах ворот,
  // чтобы позиция не зависела от выбранного пресета поля:
  // side: доля полуширины ворот (-1 = левая штанга, 0 = центр, +1 = правая штанга);
  // depth: метры от линии ворот.
  goalTarget?: {
    side: number;
    depth: number;
  };
  freeKick?: {
    recommendedWallCount: number;
    initialWall: WallConfig;
    // Целевая зона стенки вычисляется геометрически (см. freeKickWallZone),
    // поле оставлено для ручного переопределения в особых уровнях.
    wallZone?: Zone;
  };
  pitchPresetOverride?: PitchPresetId;
  mainErrorType: ErrorType;
  successText: string;
  almostText: string;
  errorText: string;
  hintText: string;
  evaluationMode: "zone" | "geometry" | "hybrid";
  explanationLayers: ExplanationLayers;
};

export type EvaluationScore = {
  scenarioType: ScenarioType;
  lineScore: number;
  depthScore: number;
  nearPostScore: number;
  defenderScore: number;
  passScore: number;
  orientationScore: number;
  wallCountScore?: number;
  wallPositionScore?: number;
  wallZone?: Zone;
  correctOrientedZone?: OrientedZone;
  almostOrientedZone?: OrientedZone;
  dangerOrientedZone?: OrientedZone;
  tooDeepOrientedZone?: OrientedZone;
  tooHighOrientedZone?: OrientedZone;
  total: number;
  mainErrorType?: ErrorType;
  outsideShotAngle?: boolean;
  // Процент ширины ворот, открытый нападающему (0-100): из выбранной позиции
  // и из лучшей точки. Не считается для стандартов без прямого удара.
  openGoalPercent?: number;
  optimalOpenGoalPercent?: number;
  // Точка на линии ворот, куда летит удар в самую открытую часть (проценты поля).
  openShotTarget?: Point;
  goalkeeperPoint: Point;
  optimalPoint: Point;
  correctZone: Zone;
  notes: string[];
};

export type CheckResult = {
  result: ResultKind;
  score: number;
  text: string;
  repeat: boolean;
  errorType?: ErrorType;
  evaluation: EvaluationScore;
};

export type LevelProgress = {
  attempts: number;
  bestScore: number;
  lastResult: ResultKind;
  needsRepeat: boolean;
  correctStreak: number;
  wrongAttempts: number;
  almostAttempts: number;
  lastErrorType?: ErrorType;
  errorCounts: Partial<Record<ErrorType, number>>;
};

export type Progress = Record<string, LevelProgress>;

export type PlayerProfile = {
  id: string;
  name: string;
  createdAt: string;
};
