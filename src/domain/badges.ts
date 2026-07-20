import type { Level, LevelCategory, Progress } from "./types";

// Бейджи за освоенные навыки. Бейдж выдается за количество ситуаций
// категории, решенных на «Отлично» (последний результат - correct).

export type BadgeState = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progressLabel: string;
};

type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  categories: LevelCategory[];
  goal: number;
};

const badgeDefinitions: BadgeDefinition[] = [
  {
    id: "near-post",
    title: "Ближний угол закрыт",
    description: "Реши на «Отлично» 4 ситуации на угол удара",
    categories: ["shot_angle"],
    goal: 4
  },
  {
    id: "depth",
    title: "Хорошая глубина",
    description: "Реши на «Отлично» 4 ситуации на глубину позиции",
    categories: ["depth"],
    goal: 4
  },
  {
    id: "one-v-one",
    title: "Сильный 1-в-1",
    description: "Реши на «Отлично» 4 выхода один в один",
    categories: ["one_v_one"],
    goal: 4
  },
  {
    id: "reposition",
    title: "Быстрое перестроение",
    description: "Реши на «Отлично» 5 ситуаций с пасом, прострелом или отскоком",
    categories: ["pass_reposition"],
    goal: 5
  },
  {
    id: "defender",
    title: "Читает защитника",
    description: "Реши на «Отлично» 4 ситуации с давлением защитника",
    categories: ["defender_pressure"],
    goal: 4
  },
  {
    id: "box-master",
    title: "Хозяин штрафной",
    description: "Реши на «Отлично» 6 угловых и навесов",
    categories: ["corner", "cross"],
    goal: 6
  },
  {
    id: "set-piece",
    title: "Мастер стандартов",
    description: "Реши на «Отлично» 5 штрафных и пенальти",
    categories: ["free_kick", "penalty"],
    goal: 5
  },
  {
    id: "reaction",
    title: "Молния",
    description: "Реши на «Отлично» 8 реакционных сценариев",
    categories: ["reaction"],
    goal: 8
  }
];

export function computeBadges(progress: Progress, allLevels: Level[], penaltyBest: number | null): BadgeState[] {
  const states = badgeDefinitions.map((definition) => {
    const solved = allLevels.filter(
      (level) => definition.categories.includes(level.category) && progress[level.id]?.lastResult === "correct"
    ).length;
    const count = Math.min(solved, definition.goal);

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      earned: solved >= definition.goal,
      progressLabel: `${count}/${definition.goal}`
    };
  });

  const shootoutSaves = Math.min(penaltyBest ?? 0, 4);

  states.push({
    id: "shootout-wall",
    title: "Стена на пенальти",
    description: "Сделай 4 сейва в одной серии пенальти",
    earned: (penaltyBest ?? 0) >= 4,
    progressLabel: `${shootoutSaves}/4`
  });

  return states;
}

// Звание вратаря по числу закрепленных сценариев (2 «Отлично» подряд).
export function keeperRank(masteredTotal: number) {
  if (masteredTotal >= 60) {
    return "Легенда";
  }

  if (masteredTotal >= 45) {
    return "Стена";
  }

  if (masteredTotal >= 25) {
    return "Хозяин штрафной";
  }

  if (masteredTotal >= 10) {
    return "Уверенный";
  }

  return "Новичок";
}

export function newlyEarnedBadges(before: BadgeState[], after: BadgeState[]): BadgeState[] {
  const earnedBefore = new Set(before.filter((badge) => badge.earned).map((badge) => badge.id));

  return after.filter((badge) => badge.earned && !earnedBefore.has(badge.id));
}
