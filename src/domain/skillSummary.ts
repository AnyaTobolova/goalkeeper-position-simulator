import type { Level, LevelCategory, Progress } from "./types";

const titles: Record<LevelCategory, string> = {
  shot_angle: "Угол удара",
  depth: "Глубина позиции",
  one_v_one: "Выход один на один",
  defender_pressure: "Помощь защитника",
  pass_reposition: "Перестроение после паса",
  reaction: "Реакция на мяч",
  cross: "Навесы",
  corner: "Угловые",
  free_kick: "Штрафные и стенка",
  penalty: "Пенальти"
};

export function summarizeSkills(levels: Level[], progress: Progress) {
  const groups = new Map<LevelCategory, { attempts: number; excellent: number; scenarios: number }>();
  for (const level of levels) {
    const item = progress[level.id];
    if (!item || !Number.isFinite(item.attempts) || !Number.isFinite(item.wrongAttempts) || !Number.isFinite(item.almostAttempts)) continue;
    const excellent = item.attempts - item.wrongAttempts - item.almostAttempts;
    if (item.attempts <= 0 || excellent < 0 || item.wrongAttempts < 0 || item.almostAttempts < 0) continue;
    const group = groups.get(level.category) ?? { attempts: 0, excellent: 0, scenarios: 0 };
    group.attempts += item.attempts;
    group.excellent += excellent;
    group.scenarios += 1;
    groups.set(level.category, group);
  }

  const qualified = [...groups].filter(([, group]) => group.attempts >= 3 && group.scenarios >= 2)
    .map(([category, group]) => ({ category, title: titles[category], ...group, rate: group.excellent / group.attempts }));
  return {
    strong: qualified.filter((item) => item.rate >= 0.7).sort((a, b) => b.rate - a.rate),
    practice: qualified.filter((item) => item.rate < 0.7).sort((a, b) => a.rate - b.rate),
    penaltyAttempts: groups.get("penalty")?.attempts ?? 0
  };
}
