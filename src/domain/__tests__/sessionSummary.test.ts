import { describe, expect, it } from "vitest";
import { firstAttempts, marathonPoints, type SessionAttempt } from "../sessionSummary";

describe("итоги тренировки", () => {
  it("сохраняет все попытки и считает очки марафона по первой попытке каждой ситуации", () => {
    const attempts: SessionAttempt[] = [
      { levelId: "one", result: "dangerous", score: 35 },
      { levelId: "one", result: "correct", score: 100 },
      { levelId: "two", result: "almost", score: 75 },
      { levelId: "two", result: "correct", score: 95 }
    ];

    expect(attempts).toHaveLength(4);
    expect(firstAttempts(attempts)).toEqual([attempts[0], attempts[2]]);
    expect(marathonPoints(attempts)).toBe(110);
  });
});
