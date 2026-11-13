import { afterEach, expect, it, vi } from "vitest";
import { deletePlayerData } from "../../storage";

afterEach(() => vi.unstubAllGlobals());

it("удаляет только данные выбранного игрока, включая рекорды и старый формат", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    removeItem: (key: string) => values.delete(key),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  });
  const keys = ["progress", "last-level", "last-level:base_position", "last-level:reaction_to_ball_owner", "penalty-best", "day-streak", "marathon-best"];
  for (const key of keys) {
    values.set(`goalkeeper-sim:${key}:удалить`, "1");
    values.set(`goalkeeper-sim:${key}:оставить`, "2");
  }
  values.set("goalkeeper-sim:pitch", "общие настройки");
  deletePlayerData("удалить");
  for (const key of keys) {
    expect(values.has(`goalkeeper-sim:${key}:удалить`)).toBe(false);
    expect(values.get(`goalkeeper-sim:${key}:оставить`)).toBe("2");
  }
  expect(values.get("goalkeeper-sim:pitch")).toBe("общие настройки");
});
