import { useEffect, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";

// Мини-режим «Серия пенальти»: 5 ударов, вид на ворота анфас.
// Учит два навыка: помнить правило «ноги на линии до удара»
// и быстро выбирать угол, когда мяч уже летит.

type PenaltyShootoutProps = {
  bestScore: number | null;
  onFinish: (saves: number) => void;
  onClose: () => void;
};

type Phase = "ready" | "windup" | "flying" | "outcome" | "done";

const totalShots = 5;
const flyWindowMs = 950;
const zoneLabels = ["Левый угол", "Центр", "Правый угол"];

export function PenaltyShootout({ bestScore, onFinish, onClose }: PenaltyShootoutProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<("save" | "goal")[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function schedule(callback: () => void, delay: number) {
    timersRef.current.push(window.setTimeout(callback, delay));
  }

  function strike() {
    if (phase !== "ready") {
      return;
    }

    setPhase("windup");
    setPicked(null);
    setTarget(null);
    schedule(() => {
      const shotTarget = Math.floor(Math.random() * 3);
      setTarget(shotTarget);
      setPhase("flying");
      schedule(() => {
        // Если угол не выбран за время полета - гол.
        setPhase((current) => {
          if (current === "flying") {
            finishRound(null, shotTarget);
            return "outcome";
          }

          return current;
        });
      }, flyWindowMs);
    }, 650 + Math.random() * 750);
  }

  function finishRound(pickedZone: number | null, shotTarget: number) {
    const saved = pickedZone !== null && pickedZone === shotTarget;
    setResults((current) => {
      const next = [...current, saved ? ("save" as const) : ("goal" as const)];

      schedule(() => {
        if (next.length >= totalShots) {
          setPhase("done");
          onFinish(next.filter((item) => item === "save").length);
        } else {
          setRound(next.length);
          setPhase("ready");
          setTarget(null);
          setPicked(null);
        }
      }, 1400);

      return next;
    });
  }

  function pickZone(zone: number) {
    if (phase !== "flying" || picked !== null || target === null) {
      return;
    }

    setPicked(zone);
    setPhase("outcome");
    finishRound(zone, target);
  }

  function restart() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    setPhase("ready");
    setRound(0);
    setTarget(null);
    setPicked(null);
    setResults([]);
  }

  const saves = results.filter((item) => item === "save").length;
  const lastResult = results[results.length - 1];
  const keeperZone = phase === "outcome" || phase === "done" ? (picked ?? 1) : 1;
  const ballZone = target ?? 1;
  const ballFlying = phase === "flying" || phase === "outcome" || (phase === "done" && target !== null);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal shootout-modal" role="dialog" aria-modal="true" aria-label="Серия пенальти">
        <div className="modal-header">
          <div>
            <div className="eyebrow">Серия пенальти</div>
            <h2>Удар {Math.min(round + 1, totalShots)} из {totalShots}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="shootout-score" aria-label="Счет серии">
          {Array.from({ length: totalShots }).map((_, index) => (
            <span key={index} className={`shootout-dot ${results[index] ?? "pending"}`} />
          ))}
          {bestScore !== null && <small>лучшая серия: {bestScore}/{totalShots}</small>}
        </div>

        <div className={`shootout-goal phase-${phase}`}>
          <div className="shootout-crossbar" />
          <div className="shootout-post left" />
          <div className="shootout-post right" />
          <div className={`shootout-keeper zone-${keeperZone}`} />
          <div className={`shootout-ball ${ballFlying ? `fly zone-${ballZone}` : ""}`} />
          {(phase === "ready" || phase === "windup" || phase === "flying") &&
            zoneLabels.map((label, zone) => (
              <button
                key={label}
                type="button"
                className={`shootout-zone zone-${zone} ${phase === "flying" ? "armed" : "preview"}`}
                aria-label={label}
                disabled={phase !== "flying"}
                onClick={() => pickZone(zone)}
              >
                {zone === 0 ? "Лево" : zone === 1 ? "Центр" : "Право"}
              </button>
            ))}
          {phase === "outcome" && lastResult && (
            <div className={`shootout-verdict ${lastResult}`}>{lastResult === "save" ? "Сейв!" : "Гол"}</div>
          )}
        </div>

        {phase === "ready" && (
          <div className="shootout-hint">
            <p>
              <strong>Мини-игра на реакцию.</strong> Соперник пробьет пенальти в одну из трех зон ворот. Когда мяч
              полетит - успей нажать зону, куда идет удар: угадал - сейв. Всего 5 ударов.
            </p>
            <p className="shootout-rule">По правилам до удара держи хотя бы часть одной ноги на линии ворот.</p>
            <button className="primary" type="button" onClick={strike}>
              <span>Я на линии. Удар!</span>
            </button>
          </div>
        )}

        {phase === "windup" && <div className="shootout-hint"><p>Нападающий разбегается...</p></div>}
        {phase === "flying" && <div className="shootout-hint"><p>Куда летит мяч? Жми угол!</p></div>}

        {phase === "done" && (
          <div className="shootout-hint">
            <strong className="shootout-final">
              {saves} из {totalShots} сейвов
            </strong>
            <p>
              {saves >= 4
                ? "Серия почти идеальная - настоящая вратарская реакция."
                : saves >= 2
                  ? "Хорошая серия. Следи за мячом до самого удара и решай быстрее."
                  : "Пенальти - лотерея даже для профи. Попробуй еще серию."}
            </p>
            <div className="modal-actions">
              <button type="button" onClick={restart}>
                <RotateCcw size={18} />
                <span>Еще серия</span>
              </button>
              <button className="primary" type="button" onClick={onClose}>
                <span>Готово</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
