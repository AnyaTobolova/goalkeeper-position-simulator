import { afterEach, describe, expect, it, vi } from "vitest";
import { localDate, previousDate } from "../calendar";
import { recordDayTraining } from "../../storage";

afterEach(() => vi.unstubAllGlobals());

describe("календарь тренировок", () => {
  it("берёт дату устройства по местному календарю", () => {
    const before = new Date(2026, 10, 15, 23, 59);
    const after = new Date(2026, 10, 16, 0, 1);
    expect(localDate(before)).toBe("2026-11-15");
    expect(localDate(after)).toBe("2026-11-16");
  });

  it("в Петербурге после полуночи не использует предыдущую дату UTC", () => {
    if (Intl.DateTimeFormat().resolvedOptions().timeZone !== "Europe/Moscow") return;
    expect(localDate(new Date("2026-11-15T21:01:00Z"))).toBe("2026-11-16");
  });

  it("правильно находит вчера при смене месяца, года и в високосный год", () => {
    expect(previousDate("2026-01-01")).toBe("2025-12-31");
    expect(previousDate("2026-03-01")).toBe("2026-02-28");
    expect(previousDate("2024-03-01")).toBe("2024-02-29");
  });

  it("продолжает серию на следующий день, не удваивает её в тот же день и сбрасывает после пропуска", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    expect(recordDayTraining("test", "2026-12-31").streak).toBe(1);
    expect(recordDayTraining("test", "2027-01-01").streak).toBe(2);
    expect(recordDayTraining("test", "2027-01-01").streak).toBe(2);
    expect(recordDayTraining("test", "2027-01-03")).toEqual({ lastDate: "2027-01-03", streak: 1, best: 2 });
  });
});
