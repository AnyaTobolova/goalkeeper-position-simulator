import { describe, expect, it } from "vitest";
import type { LevelProgress } from "../types";
import { repeatReason } from "../repeatReason";

const record: LevelProgress = { attempts: 1, bestScore: 100, lastResult: "correct", needsRepeat: true, correctStreak: 1, wrongAttempts: 0, almostAttempts: 0, errorCounts: {} };

describe("причина повтора", () => {
  it("отличает закрепление от исправления и сохраняет правило двух отличных ответов", () => {
    expect(repeatReason(record)).toBe("reinforce");
    expect(repeatReason({ ...record, wrongAttempts: 2 })).toBe("reinforce");
    expect(repeatReason({ ...record, lastResult: "almost", correctStreak: 0 })).toBe("fix");
    expect(repeatReason({ ...record, lastResult: "dangerous", correctStreak: 0 })).toBe("fix");
    expect(repeatReason({ ...record, needsRepeat: false, correctStreak: 2 })).toBeNull();
    expect(repeatReason()).toBeNull();
  });
});
