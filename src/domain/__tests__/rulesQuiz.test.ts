import { describe, expect, it } from "vitest";
import { rulesQuizCards, shuffleQuizAnswers } from "../rulesQuiz";

describe("варианты квиза", () => {
  it("сохраняет один правильный ответ и использует обе позиции даже при одинаковых случайных значениях", () => {
    for (const random of [() => 0, () => 0.99]) {
      const cards = shuffleQuizAnswers(rulesQuizCards, random);
      expect(new Set(cards.map((card) => card.answers.findIndex((answer) => answer.correct)))).toEqual(new Set([0, 1]));
      for (const card of cards) expect(card.answers.filter((answer) => answer.correct)).toHaveLength(1);
    }
    expect(rulesQuizCards.every((card) => card.answers[0].correct)).toBe(true);
  });

  it("содержит отдельный вопрос о намеренном обходе правила", () => {
    const card = rulesQuizCards.find((item) => item.id === "backpass-trick")!;
    expect(card.explanation).toContain("даже если вратарь не коснулся мяча руками");
    expect(card.answers.find((answer) => answer.correct)?.text).toContain("обход");
  });
});
