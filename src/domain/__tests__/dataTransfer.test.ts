import { describe, expect, it } from "vitest";
import { parseProgressExport, replaceGameData } from "../../storage";

function storageWith(initial: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear()
  };
}

describe("перенос данных", () => {
  it("читает прежний формат и заменяет все данные игры, не затрагивая другие", () => {
    const storage = storageWith({ "goalkeeper-sim:old": "старые", "other-app:data": "чужие" });
    const entries = parseProgressExport({ app: "goalkeeper-sim", version: 1, entries: { "goalkeeper-sim:players": "[]" } });
    replaceGameData(entries, storage);
    expect(storage.getItem("goalkeeper-sim:old")).toBeNull();
    expect(storage.getItem("goalkeeper-sim:players")).toBe("[]");
    expect(storage.getItem("other-app:data")).toBe("чужие");
  });

  it("отклоняет пустой или повреждённый комплект до изменения данных", () => {
    for (const entries of [{}, [], { "other-app:data": "x" }, { "goalkeeper-sim:players": 1 }]) {
      expect(() => parseProgressExport({ app: "goalkeeper-sim", entries })).toThrow();
    }
  });

  it("восстанавливает прежние данные при ошибке записи", () => {
    const storage = storageWith({ "goalkeeper-sim:old": "старые", "other-app:data": "чужие" });
    const setItem = storage.setItem;
    storage.setItem = (key, value) => {
      if (key === "goalkeeper-sim:new") throw new Error("Нет места");
      setItem(key, value);
    };
    expect(() => replaceGameData({ "goalkeeper-sim:new": "новые" }, storage)).toThrow();
    expect(storage.getItem("goalkeeper-sim:old")).toBe("старые");
    expect(storage.getItem("other-app:data")).toBe("чужие");
  });
});
