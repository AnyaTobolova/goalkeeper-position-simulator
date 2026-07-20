import { useState } from "react";
import { BookOpen, RotateCcw, X } from "lucide-react";
import { rulesQuizCards } from "../domain/rulesQuiz";

type RulesQuizProps = {
  onClose: () => void;
};

export function RulesQuiz({ onClose }: RulesQuizProps) {
  const [cardIndex, setCardIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const card = rulesQuizCards[Math.min(cardIndex, rulesQuizCards.length - 1)];

  function chooseAnswer(index: number) {
    if (selectedIndex !== null) {
      return;
    }

    setSelectedIndex(index);

    if (card.answers[index].correct) {
      setCorrectCount((current) => current + 1);
    }
  }

  function nextCard() {
    if (cardIndex >= rulesQuizCards.length - 1) {
      setFinished(true);
      return;
    }

    setCardIndex((current) => current + 1);
    setSelectedIndex(null);
  }

  function restart() {
    setCardIndex(0);
    setSelectedIndex(null);
    setCorrectCount(0);
    setFinished(false);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal rules-quiz-modal" role="dialog" aria-modal="true" aria-label="Правила вратаря">
        <div className="modal-header">
          <div>
            <div className="eyebrow">Знание правил</div>
            <h2>Правила вратаря</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {finished ? (
          <div className="rules-quiz-summary">
            <BookOpen size={28} />
            <strong>
              Верно {correctCount} из {rulesQuizCards.length}
            </strong>
            <p>
              {correctCount === rulesQuizCards.length
                ? "Отлично: ты знаешь правила вратаря. Повтори квиз через пару недель, чтобы закрепить."
                : "Хорошая тренировка. Перечитай объяснения к ошибкам и пройди квиз еще раз."}
            </p>
            <div className="modal-actions">
              <button type="button" onClick={restart}>
                <RotateCcw size={18} />
                <span>Пройти еще раз</span>
              </button>
              <button className="primary" type="button" onClick={onClose}>
                <span>Готово</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rules-quiz-card">
            <div className="rules-quiz-progress">
              Вопрос {cardIndex + 1} из {rulesQuizCards.length}
            </div>
            <p className="rules-quiz-question">{card.question}</p>
            <div className="rules-quiz-answers">
              {card.answers.map((answer, index) => {
                const state =
                  selectedIndex === null ? "" : answer.correct ? "correct" : index === selectedIndex ? "wrong" : "muted";

                return (
                  <button key={answer.text} type="button" className={`rules-quiz-answer ${state}`} onClick={() => chooseAnswer(index)}>
                    {answer.text}
                  </button>
                );
              })}
            </div>
            {selectedIndex !== null && (
              <div className={`rules-quiz-explanation ${card.answers[selectedIndex].correct ? "correct" : "wrong"}`}>
                <strong>{card.answers[selectedIndex].correct ? "Верно!" : "Не совсем."}</strong>
                <span>{card.explanation}</span>
              </div>
            )}
            <div className="modal-actions">
              <button className="primary" type="button" onClick={nextCard} disabled={selectedIndex === null}>
                <span>{cardIndex >= rulesQuizCards.length - 1 ? "Итог" : "Дальше"}</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
